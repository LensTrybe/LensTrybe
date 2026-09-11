import LegalDocument from '../../components/legal/LegalDocument'
import { FOUNDING_TERMS_INTRO, FOUNDING_TERMS_SECTIONS, FOUNDING_TERMS_TITLE, FOUNDING_TERMS_UPDATED } from '../../lib/foundingTerms'

// The Founding Creative Agreement (terms for the Founding 100). The wording lives in
// src/lib/foundingTerms.js so the signup step shows exactly the same text.
export default function FoundingAgreementPage() {
  return <LegalDocument title={FOUNDING_TERMS_TITLE} updated={FOUNDING_TERMS_UPDATED} intro={FOUNDING_TERMS_INTRO} sections={FOUNDING_TERMS_SECTIONS} />
}
