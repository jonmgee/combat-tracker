-- Migration 003: Add notification, Alert feat toggles, and Alert usage track to participants

ALTER TABLE participants
  ADD COLUMN notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN alert_feat boolean NOT NULL DEFAULT false,
  ADD COLUMN alert_used boolean NOT NULL DEFAULT false;
