# Gemfile
source "https://rubygems.org"


gem "jekyll", "~> 4.3"
gem "jekyll-theme-chirpy", "~> 6.5"   # or your preferred 6.x
gem "webrick", "~> 1.8"

group :test do
  gem "html-proofer", "~> 3.18"
end

platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.1.1", platforms: [:mingw, :x64_mingw, :mswin]

gem "http_parser.rb", "~> 0.6.0", platforms: [:jruby]

if RUBY_PLATFORM =~ /linux-musl/
  gem "jekyll-sass-converter", "~> 2.0"
end
