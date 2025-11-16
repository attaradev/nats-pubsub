# frozen_string_literal: true

require 'sinatra/base'
require 'json'
require 'erb'
require_relative 'core/model_utils'

module NatsPubsub
  # Web UI for monitoring Inbox and Outbox events
  # Mount this in your Rails routes or run standalone
  #
  # Example (Rails):
  #   mount NatsPubsub::Web, at: '/jetstream'
  #
  # Example (Standalone):
  #   run NatsPubsub::Web
  class Web < Sinatra::Base
    set :root, File.expand_path('../..', __dir__)
    set :views, proc { File.join(root, 'lib/nats_pubsub/web/views') }
    set :public_folder, proc { File.join(root, 'lib/nats_pubsub/web/public') }

    helpers do
      def outbox_model
        @outbox_model ||= ModelUtils.constantize(NatsPubsub.config.outbox_model)
      end

      def inbox_model
        @inbox_model ||= ModelUtils.constantize(NatsPubsub.config.inbox_model)
      end

      def format_time(time)
        return 'N/A' unless time

        time.strftime('%Y-%m-%d %H:%M:%S %Z')
      end

      def status_badge_class(status)
        case status.to_s.downcase
        when 'sent', 'processed'
          'success'
        when 'failed'
          'danger'
        when 'publishing', 'processing'
          'warning'
        else
          'secondary'
        end
      end

      def truncate(text, length = 50)
        return '' unless text

        text = text.to_s
        text.length > length ? "#{text[0...length]}..." : text
      end
    end

    # Dashboard
    get '/' do
      @outbox_stats = calculate_outbox_stats
      @inbox_stats = calculate_inbox_stats
      erb :dashboard
    end

    # Outbox list
    get '/outbox' do
      @page = (params[:page] || 1).to_i
      @per_page = 50
      @status_filter = params[:status]

      query = outbox_model
      query = query.where(status: @status_filter) if @status_filter
      query = query.order(created_at: :desc)

      @total = query.count
      @events = query.offset((@page - 1) * @per_page).limit(@per_page)
      @total_pages = (@total.to_f / @per_page).ceil

      erb :outbox_list
    end

    # Outbox detail
    get '/outbox/:id' do
      @event = outbox_model.find(params[:id])
      erb :outbox_detail
    end

    # Retry outbox event
    post '/outbox/:id/retry' do
      event = outbox_model.find(params[:id])
      event.update!(status: 'pending', last_error: nil)

      redirect back
    end

    # Delete outbox event
    delete '/outbox/:id' do
      event = outbox_model.find(params[:id])
      event.destroy

      redirect '/outbox'
    end

    # Inbox list
    get '/inbox' do
      @page = (params[:page] || 1).to_i
      @per_page = 50
      @status_filter = params[:status]

      query = inbox_model
      query = query.where(status: @status_filter) if @status_filter
      query = query.order(created_at: :desc)

      @total = query.count
      @events = query.offset((@page - 1) * @per_page).limit(@per_page)
      @total_pages = (@total.to_f / @per_page).ceil

      erb :inbox_list
    end

    # Inbox detail
    get '/inbox/:id' do
      @event = inbox_model.find(params[:id])
      erb :inbox_detail
    end

    # Reprocess inbox event
    post '/inbox/:id/reprocess' do
      event = inbox_model.find(params[:id])
      event.update!(status: 'received', last_error: nil)

      redirect back
    end

    # Delete inbox event
    delete '/inbox/:id' do
      event = inbox_model.find(params[:id])
      event.destroy

      redirect '/inbox'
    end

    # Health check
    get '/health' do
      content_type :json
      { status: 'ok', timestamp: Time.now.utc }.to_json
    end

    private

    def calculate_outbox_stats
      return {} unless ModelUtils.ar_class?(outbox_model)

      {
        total: outbox_model.count,
        pending: outbox_model.where(status: 'pending').count,
        publishing: outbox_model.where(status: 'publishing').count,
        sent: outbox_model.where(status: 'sent').count,
        failed: outbox_model.where(status: 'failed').count
      }
    rescue StandardError => e
      Logging.error("Failed to calculate outbox stats: #{e.message}")
      {}
    end

    def calculate_inbox_stats
      return {} unless ModelUtils.ar_class?(inbox_model)

      {
        total: inbox_model.count,
        received: inbox_model.where(status: 'received').count,
        processing: inbox_model.where(status: 'processing').count,
        processed: inbox_model.where(status: 'processed').count,
        failed: inbox_model.where(status: 'failed').count
      }
    rescue StandardError => e
      Logging.error("Failed to calculate inbox stats: #{e.message}")
      {}
    end
  end
end
