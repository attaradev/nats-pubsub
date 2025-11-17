FROM ruby:3.2-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache build-base postgresql-dev

# Copy Gemfile
COPY Gemfile Gemfile.lock ./
RUN bundle install

# Copy source
COPY . .

# Expose port
EXPOSE 3003

# Start application
CMD ["bundle", "exec", "ruby", "app.rb"]
