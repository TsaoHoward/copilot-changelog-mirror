require "cgi"
require "uri"

module Jekyll
  module ArchiveRelativeUrlFilters
    def resolve_archive_relative_urls(html, source_url)
      base = URI.parse(source_url)
      html.gsub(/\b(href|src)=(['"])(.*?)\2/i) do |attribute|
        name = Regexp.last_match(1)
        quote = Regexp.last_match(2)
        value = CGI.unescapeHTML(Regexp.last_match(3))
        parsed = URI.parse(value)

        if value.empty? || value.start_with?("#", "/") || parsed.scheme || parsed.host
          attribute
        else
          resolved = URI.join(base.to_s, value).to_s
          "#{name}=#{quote}#{CGI.escapeHTML(resolved)}#{quote}"
        end
      rescue URI::InvalidURIError
        attribute
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::ArchiveRelativeUrlFilters)
