-- Add product_id to topic_groups table
ALTER TABLE topic_groups 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- Add configuration column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}'::jsonb;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_topic_groups_product_id ON topic_groups(product_id);

-- Comment
COMMENT ON COLUMN products.configuration is 'Stores product-specific settings like pain points, navigation preferences, etc.';
