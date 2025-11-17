require 'pg'

module InventoryService
  class InventoryRepository
    attr_reader :pool

    def initialize
      @pool = PG.connect(Config.database_url)
    end

    def initialize_db
      @pool.exec(<<~SQL)
        CREATE TABLE IF NOT EXISTS products (
          product_id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          reserved_quantity INTEGER NOT NULL DEFAULT 0,
          price DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS reservations (
          id VARCHAR(255) PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          product_id VARCHAR(255) NOT NULL REFERENCES products(product_id),
          quantity INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_reservations_order_id ON reservations(order_id);
        CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
      SQL
      puts 'Inventory repository initialized'
    end

    def create_product(product_id, name, quantity, price)
      result = @pool.exec_params(
        'INSERT INTO products (product_id, name, quantity, price) VALUES ($1, $2, $3, $4) RETURNING *',
        [product_id, name, quantity, price]
      )
      map_row_to_product(result[0])
    end

    def find_product(product_id)
      result = @pool.exec_params('SELECT * FROM products WHERE product_id = $1', [product_id])
      result.ntuples > 0 ? map_row_to_product(result[0]) : nil
    end

    def update_quantity(product_id, quantity_change)
      result = @pool.exec_params(
        'UPDATE products SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2 RETURNING *',
        [quantity_change, product_id]
      )
      result.ntuples > 0 ? map_row_to_product(result[0]) : nil
    end

    def reserve_quantity(product_id, quantity)
      result = @pool.exec_params(
        'UPDATE products SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() WHERE product_id = $2 AND (quantity - reserved_quantity) >= $1 RETURNING *',
        [quantity, product_id]
      )
      result.ntuples > 0 ? map_row_to_product(result[0]) : nil
    end

    def create_reservation(id, order_id, product_id, quantity, status)
      result = @pool.exec_params(
        'INSERT INTO reservations (id, order_id, product_id, quantity, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [id, order_id, product_id, quantity, status]
      )
      map_row_to_reservation(result[0])
    end

    def find_reservations_by_order(order_id)
      result = @pool.exec_params('SELECT * FROM reservations WHERE order_id = $1', [order_id])
      result.map { |row| map_row_to_reservation(row) }
    end

    def close
      @pool.close
    end

    private

    def map_row_to_product(row)
      {
        product_id: row['product_id'],
        name: row['name'],
        quantity: row['quantity'].to_i,
        reserved_quantity: row['reserved_quantity'].to_i,
        price: row['price'].to_f,
        created_at: row['created_at'],
        updated_at: row['updated_at']
      }
    end

    def map_row_to_reservation(row)
      {
        id: row['id'],
        order_id: row['order_id'],
        product_id: row['product_id'],
        quantity: row['quantity'].to_i,
        status: row['status'],
        created_at: row['created_at'],
        updated_at: row['updated_at']
      }
    end
  end
end
