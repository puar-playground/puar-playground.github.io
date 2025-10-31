# frozen_string_literal: true

require 'net/http'
require 'json'
require 'uri'
require 'fileutils'

Jekyll::Hooks.register :site, :pre_render do |site|
  # Fetch arXiv data at build time
  api_base = 'https://arxiv-backend-production.up.railway.app/arxiv'
  
  begin
    # Fetch latest data
    uri = URI("#{api_base}/latest.json")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.read_timeout = 30
    http.open_timeout = 10
    
    Jekyll.logger.info "arXiv:", "Fetching data from #{uri}..."
    response = http.get(uri.path + (uri.query ? "?#{uri.query}" : ''))
    
    if response.code == '200'
      data = JSON.parse(response.body)
      # Ensure it's always an array
      if data.is_a?(Array)
        site.data['arxiv_latest'] = data
        Jekyll.logger.info "arXiv:", "Fetched #{data.length} items"
      elsif data.is_a?(Hash) && data.key?('data') && data['data'].is_a?(Array)
        site.data['arxiv_latest'] = data['data']
        Jekyll.logger.info "arXiv:", "Fetched #{data['data'].length} items from data field"
      else
        # Try to extract array from response
        site.data['arxiv_latest'] = data.is_a?(Hash) ? [] : (data || [])
        Jekyll.logger.warn "arXiv:", "Unexpected response format, storing as empty array"
      end
    else
      Jekyll.logger.warn "arXiv:", "Failed to fetch data: HTTP #{response.code}"
      site.data['arxiv_latest'] = []
    end
    
    # Fetch history list
    uri_history = URI("#{api_base}/history")
    http_history = Net::HTTP.new(uri_history.host, uri_history.port)
    http_history.use_ssl = true
    http_history.read_timeout = 30
    http_history.open_timeout = 10
    
    response_history = http_history.get(uri_history.path)
    
    if response_history.code == '200'
      history_files = JSON.parse(response_history.body)
      if history_files.is_a?(Array)
        site.data['arxiv_history'] = history_files
        Jekyll.logger.info "arXiv:", "Fetched #{history_files.length} history files"
      else
        site.data['arxiv_history'] = []
        Jekyll.logger.warn "arXiv:", "History response is not an array"
      end
    else
      site.data['arxiv_history'] = []
      Jekyll.logger.warn "arXiv:", "Failed to fetch history: HTTP #{response_history.code}"
    end
    
  rescue StandardError => e
    Jekyll.logger.error "arXiv:", "Error fetching data: #{e.class} - #{e.message}"
    Jekyll.logger.error "arXiv:", e.backtrace.first(3).join("\n") if e.backtrace
    site.data['arxiv_latest'] = []
    site.data['arxiv_history'] = []
  end
  
  # Also write data to a JSON file for client-side loading (avoids CORS)
  # Write to source directory so Jekyll will copy it to the output
  begin
    data_dir = File.join(site.source, 'assets', 'js', 'data')
    FileUtils.mkdir_p(data_dir) unless File.directory?(data_dir)
    
    arxiv_json_path = File.join(data_dir, 'arxiv-latest.json')
    json_content = JSON.pretty_generate(site.data['arxiv_latest'] || [])
    File.write(arxiv_json_path, json_content)
    Jekyll.logger.info "arXiv:", "Written JSON data to #{arxiv_json_path} (#{json_content.bytesize} bytes)"
    
    history_json_path = File.join(data_dir, 'arxiv-history.json')
    history_content = JSON.pretty_generate(site.data['arxiv_history'] || [])
    File.write(history_json_path, history_content)
    Jekyll.logger.info "arXiv:", "Written history data to #{history_json_path} (#{history_content.bytesize} bytes)"
  rescue StandardError => e
    Jekyll.logger.error "arXiv:", "Failed to write JSON files: #{e.class} - #{e.message}"
    Jekyll.logger.error "arXiv:", e.backtrace.first(3).join("\n") if e.backtrace
  end
end

