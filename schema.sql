-- IceBooks Pro P&L Enhancement Migration
-- Adds editable expense categories to existing settings table

-- Add expense_categories column to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS expense_categories JSONB;

-- Update existing settings record with default expense categories
UPDATE settings 
SET expense_categories = '["Ice Time", "Music/Choreography", "Costumes", "Equipment", "Travel", "Training/Seminars", "Coaching Fees", "Membership Dues", "Insurance", "Other"]'::jsonb
WHERE expense_categories IS NULL;

-- Add mileage_rate column to settings (if not exists)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS mileage_rate DECIMAL(10,2);

-- Update existing settings with default mileage rate
UPDATE settings 
SET mileage_rate = 0.70
WHERE mileage_rate IS NULL;

-- Add vehicle_expense_method column to settings (if not exists)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS vehicle_expense_method VARCHAR(20);

-- Update existing settings with default method
UPDATE settings 
SET vehicle_expense_method = 'standard'
WHERE vehicle_expense_method IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_mileage_date ON mileage(date);

-- Migration complete!
