## MODIFIED Requirements

### Requirement: Redirect malformed UUID photo/video URLs to correctly-padded equivalents
The system SHALL permanently redirect `/photos/<malformed-id>` and `/videos/<malformed-id>` URLs to their correctly formatted UUID equivalents, where a malformed ID is any string composed entirely of zeros (`0`) and dashes (`-`) followed by a trailing integer. The system SHALL extract the trailing integer, convert it to a properly zero-padded UUID, and issue a 301 redirect.

#### Scenario: Short-padded UUID is redirected
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-29864`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/photos/00000000-0000-0000-0000-000000029864`

#### Scenario: Extra-dash malformed ID is redirected
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-0000000-29864`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/photos/00000000-0000-0000-0000-000000029864`

#### Scenario: Arbitrary zeros-and-dashes prefix is redirected
- **WHEN** a CloudFront request arrives at `/videos/0-0-0-0-12345`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/videos/00000000-0000-0000-0000-000000012345`

#### Scenario: Correctly-formatted UUID passes through
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-000000029864` (valid 36-char UUID)
- **THEN** the request SHALL pass through unchanged

#### Scenario: UUID containing hex letters passes through
- **WHEN** a CloudFront request arrives at `/photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **THEN** the request SHALL pass through unchanged (hex letters are not stripped)

#### Scenario: Query string is preserved on redirect
- **WHEN** a malformed ID URL includes a query string
- **THEN** the 301 redirect SHALL preserve the query string
