## ADDED Requirements

### Requirement: Submit a contact form
The system SHALL allow any device (identified by its `uuid`) to submit a free-text contact or feedback message.

#### Scenario: Contact form created
- **WHEN** `createContactForm(uuid, description)` is called with a non-empty description
- **THEN** a ContactForm record is inserted with the device's `uuid`, description, and current timestamps, and the new record is returned
