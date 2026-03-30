
-- TABLE: notification_channels
-- Defines available channels (email, sms, etc.) and their configuration if needed
CREATE TABLE notification_channels (
    channel_id VARCHAR(50) PRIMARY KEY, -- 'email', 'sms', 'push', 'in_app'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: notification_types
-- Defines types of triggers (e.g., ORDER_PENDING) and default templates
CREATE TABLE notification_types (
    type_id VARCHAR(50) PRIMARY KEY, -- 'ORDER_PENDING', 'VOUCHER_GRANTED'
    label VARCHAR(255) NOT NULL, -- Human readable label
    default_message_template TEXT,
    priority VARCHAR(20) DEFAULT 'LOW', -- 'HIGH', 'LOW'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: user_notification_preferences
-- Stores user-specific settings for each notification type and channel
CREATE TABLE user_notification_preferences (
    user_id VARCHAR(50) NOT NULL,
    notification_type_id VARCHAR(50) NOT NULL,
    channel_id VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, notification_type_id, channel_id),
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(type_id),
    FOREIGN KEY (channel_id) REFERENCES notification_channels(channel_id)
);

-- TABLE: notifications
-- Stores the actual notifications generated for users
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL, -- Recipient
    type VARCHAR(50) NOT NULL, -- INFO, WARNING, SUCCESS, ERROR
    trigger_type VARCHAR(50), -- Reference to notification_types
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Actionable Notification Fields
    action_type VARCHAR(50), -- 'APPROVE_ORDER', 'REJECT_ORDER'
    target_id VARCHAR(50), -- ID of the entity (Order ID, etc.)
    action_payload JSONB, -- Additional data for the action
    is_action_completed BOOLEAN DEFAULT FALSE
);

-- TABLE: buyback_agreements (NEW)
-- Hybrid approach: Relational columns for logic/search, JSONB for legal evidence
CREATE TABLE buyback_agreements (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    company_id VARCHAR(50), -- Snapshot for easy reporting
    
    -- Financials (Relational for SUM() operations)
    voucher_count INTEGER NOT NULL,
    total_value DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'PLN',
    
    -- Workflow
    status VARCHAR(20) DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, PAID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    paid_at TIMESTAMP,
    
    -- THE LEGAL SNAPSHOT (JSONB)
    -- Contains:
    -- {
    --   "user_snapshot": { "name": "Jan", "pesel": "...", "address": "...", "iban": "PL..." },
    --   "voucher_ids": ["V-1", "V-2", ...],
    --   "terms_version": "v2025.1",
    --   "client_ip": "192.168.1.1"
    -- }
    agreement_snapshot JSONB NOT NULL
);

-- INDEXES
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_buybacks_status ON buyback_agreements(status);
CREATE INDEX idx_buybacks_user ON buyback_agreements(user_id);
