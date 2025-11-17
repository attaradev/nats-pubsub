require 'securerandom'
require 'nats_pubsub'

module InventoryService
  class Service
    def initialize(repository)
      @repository = repository
    end

    def add_product(product_id, name, quantity, price)
      @repository.create_product(product_id, name, quantity, price)
    end

    def get_product(product_id)
      @repository.find_product(product_id)
    end

    def handle_order_created(order_id, items)
      puts "Processing order #{order_id} with #{items.length} items"

      reservation_id = SecureRandom.uuid
      success = true
      message = ''

      begin
        # Try to reserve inventory for all items
        items.each do |item|
          product = @repository.find_product(item['productId'])

          unless product
            success = false
            message = "Product not found: #{item['productId']}"
            break
          end

          available = product[:quantity] - product[:reserved_quantity]
          if available < item['quantity']
            success = false
            message = "Insufficient inventory for product: #{item['productId']}"
            break
          end

          # Reserve the quantity
          result = @repository.reserve_quantity(item['productId'], item['quantity'])
          unless result
            success = false
            message = "Failed to reserve inventory for product: #{item['productId']}"
            break
          end

          # Create reservation record
          @repository.create_reservation(
            SecureRandom.uuid,
            order_id,
            item['productId'],
            item['quantity'],
            'RESERVED'
          )
        end

        # Publish inventory.reserved event
        NatsPubsub.publish(
          topic: 'inventory.reserved',
          message: {
            orderId: order_id,
            reservationId: reservation_id,
            success: success,
            message: message
          }
        )

        puts "Inventory reservation #{success ? 'succeeded' : 'failed'} for order #{order_id}"
      rescue => e
        puts "Error reserving inventory: #{e.message}"

        # Publish failure event
        NatsPubsub.publish(
          topic: 'inventory.reserved',
          message: {
            orderId: order_id,
            reservationId: reservation_id,
            success: false,
            message: e.message
          }
        )
      end
    end
  end
end
