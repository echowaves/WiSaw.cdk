## ADDED Requirements

### Requirement: Redirect malformed UUID photo/video URLs to correctly-padded equivalents
The system SHALL permanently redirect `/photos/<malformed-uuid>` and `/videos/<malformed-uuid>` URLs to their correctly zero-padded UUID equivalents, where a malformed UUID matches the pattern `00000000-0000-0000-0000-{1 to 11 digits}`.

#### Scenario: Malformed UUID photo URL is redirected
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-29864`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/photos/00000000-0000-0000-0000-000000029864`

#### Scenario: Malformed UUID video URL is redirected
- **WHEN** a CloudFront request arrives at `/videos/00000000-0000-0000-0000-12345`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/videos/00000000-0000-0000-0000-000000012345`

#### Scenario: Correctly-formatted UUID passes through
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-000000029864` (12-digit last segment)
- **THEN** the request SHALL pass through unchanged (not matched by this rule)

#### Scenario: Query string is preserved on redirect
- **WHEN** a malformed UUID URL includes a query string
- **THEN** the 301 redirect SHALL preserve the query string
