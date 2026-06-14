CREATE TABLE gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  original_amount_cents INTEGER NOT NULL CHECK (original_amount_cents > 0),
  remaining_balance_cents INTEGER NOT NULL CHECK (remaining_balance_cents >= 0),
  purchaser_email VARCHAR(255) NOT NULL,
  purchaser_name VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  message TEXT,
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE,
  purchased_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_gift_card_status CHECK (status IN ('pending', 'active', 'exhausted', 'expired'))
);

CREATE TABLE gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  type VARCHAR(10) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_gift_card_tx_type CHECK (type IN ('debit', 'credit'))
);

CREATE INDEX idx_gift_cards_code ON gift_cards(code);
CREATE INDEX idx_gift_cards_status ON gift_cards(status);
CREATE INDEX idx_gift_cards_checkout_session ON gift_cards(stripe_checkout_session_id);
CREATE INDEX idx_gift_card_transactions_gift_card_id ON gift_card_transactions(gift_card_id);
CREATE INDEX idx_gift_card_transactions_appointment_id ON gift_card_transactions(appointment_id);
