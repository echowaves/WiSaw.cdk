## ADDED Requirements

### Requirement: Submit a contact form
The system SHALL allow any device (identified by its `uuid`) to submit a free-text contact or feedback message. The controller SHALL validate the device `uuid` format and use parameterized SQL for the insert query.

#### Scenario: Contact form created
- **WHEN** `createContactForm(uuid, description)` is called with a valid device `uuid` and non-empty description
- **THEN** a ContactForm record is inserted using parameterized SQL with the device's `uuid`, description, and current timestamps, and the new record is returned

#### Scenario: Invalid device uuid rejected
- **WHEN** `createContactForm` is called with an invalid `uuid` format
- **THEN** the controller SHALL throw a validation error before executing any SQL query
