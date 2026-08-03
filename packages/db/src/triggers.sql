-- PayIT Database Trigger Enforcer on Cards and Audit Logs

CREATE OR REPLACE FUNCTION enforce_card_entity_match() RETURNS trigger AS $$
BEGIN
  IF NEW.entity_id <> (SELECT entity_id FROM accounts WHERE id = NEW.account_id) THEN
    RAISE EXCEPTION 'card.entity_id must match its funding account.entity_id';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_card_entity_match 
BEFORE INSERT OR UPDATE ON cards
FOR EACH ROW EXECUTE FUNCTION enforce_card_entity_match();

-- Insert-Only Enforcement on audit_logs
CREATE OR REPLACE FUNCTION enforce_audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'UPDATE and DELETE operations are strictly forbidden on audit_logs';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION enforce_audit_logs_immutable();
