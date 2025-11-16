-- Create databases for each service
CREATE DATABASE orders;
CREATE DATABASE inventory;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE orders TO postgres;
GRANT ALL PRIVILEGES ON DATABASE inventory TO postgres;
