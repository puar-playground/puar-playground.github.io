# frozen_string_literal: true
source "https://rubygems.org"

# Pin to the exact Jekyll/plug-ins that GitHub Pages supports
gem "github-pages", group: :jekyll_plugins

# Needed for remote_theme
gem "jekyll-remote-theme"

# Local serve on Ruby 3.x
gem "webrick", "~> 1.8"

group :test do
  gem "html-proofer", "~> 3.18"
end

# Windows / JRuby extras (keep as you had)
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.1.1", platforms: [:mingw, :x64_mingw, :mswin]
gem "http_parser.rb", "~> 0.6.0", platforms: [:jruby]

# Linux-musl quirk (keep if relevant)
if RUBY_PLATFORM =~ /linux-musl/
  gem "jekyll-sass-converter", "~> 2.0"
end

gem "faraday-retry", "~> 2.3"
