import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { downloadDocumentPdf } from '../lib/downloadDocumentPdf'
import './SignContract.css'

function SignContract() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [contract, setContract] = useState(null)
  const [businessName, setBusinessName] = useState('')

  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const isSigned = useMemo(() => {
    if (!contract) return false
    const status = String(contract.status ?? '').toLowerCase().trim()
    return status === 'signed'
  }, [contract])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase || !token) {
        return
      }

      setLoading(true)
      setErrorMessage('')
      setSuccessMessage('')
      setContract(null)
      setBusinessName('')
      setAgreed(false)

      // Token-checked database function: returns only the contract for this token.
      const {
        data: signingData,
        error: contractError,
      } = await supabase.rpc('contract_for_signing', { p_token: token })
      const contractRow = signingData?.contract ?? null

      if (contractError) {
        if (!cancelled) {
          setErrorMessage(contractError.message)
          setLoading(false)
        }
        return
      }

      if (!contractRow) {
        if (!cancelled) {
          setErrorMessage('Contract not found.')
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setContract(contractRow)
        setBusinessName(String(signingData?.business_name ?? '').trim())
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [token])

  const handleDownloadPdf = async () => {
    if (!contract || pdfBusy) return
    setPdfError('')
    setPdfBusy(true)
    try { await downloadDocumentPdf({ type: 'contract', id: contract.id, signingToken: token }) }
    catch (e) { setPdfError(e?.message || 'Could not create the PDF. Please try again.') }
    setPdfBusy(false)
  }

  const handleSign = async () => {
    if (!supabase || !contract || !token) return
    if (isSigned) return
    if (!agreed) return
    if (signing) return

    setSigning(true)
    setErrorMessage('')
    setSuccessMessage('')

    const { error } = await supabase.rpc('sign_contract', { p_token: token })

    if (error) {
      setErrorMessage(error.message)
      setSigning(false)
      return
    }

    setContract((current) =>
      current
        ? {
            ...current,
            status: 'signed',
            signed_at: new Date().toISOString(),
          }
        : current,
    )
    try { await supabase.functions.invoke('notify-contract-signed', { body: { contract_id: contract.id } }) } catch { /* best effort */ }
    setSuccessMessage('Contract signed successfully. Thank you.')
    setSigning(false)
  }

  return (
    <section className="sign-contract-page">
      <div className="sign-contract-card">
        {loading ? (
          <p className="sign-contract-card__loading">Loading contract…</p>
        ) : errorMessage ? (
          <p className="sign-contract-card__error" role="alert">
            {errorMessage}
          </p>
        ) : contract ? (
          <>
            <h1 className="sign-contract-card__title">
              {businessName ? `${businessName} Contract for Signing` : 'Contract for Signing'}
            </h1>

            <div className="sign-contract-card__section">
              <p className="sign-contract-card__label">Contract Title</p>
              <p className="sign-contract-card__text sign-contract-card__text--strong">
                {contract.title ?? '—'}
              </p>
            </div>

            {contract.contract_file_url ? (
              <div className="sign-contract-card__section">
                <a
                  className="sign-contract-card__link"
                  href={contract.contract_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Contract File
                </a>
              </div>
            ) : (
              <div className="sign-contract-card__section">
                <p className="sign-contract-card__label">Contract Content</p>
                <div className="sign-contract-card__content-box" aria-label="Contract content">
                  <pre className="sign-contract-card__pre">
                    {contract.content ?? ''}
                  </pre>
                </div>
              </div>
            )}

            <div className="sign-contract-card__section">
              <p className="sign-contract-card__label">Client</p>
              <p className="sign-contract-card__text">
                {contract.client_name ?? '—'}
              </p>
              <p className="sign-contract-card__text sign-contract-card__text--muted">
                {contract.client_email ?? '—'}
              </p>
            </div>

            {isSigned ? (
              <p className="sign-contract-card__already-signed">
                This contract has already been signed.
              </p>
            ) : (
              <>
                <div className="sign-contract-card__terms">
                  <input
                    id="sign-contract-agree"
                    type="checkbox"
                    checked={agreed}
                    disabled={signing}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <label htmlFor="sign-contract-agree">
                    I agree to the terms of this contract
                  </label>
                </div>

                <button
                  type="button"
                  className="sign-contract-card__button"
                  disabled={!agreed || signing}
                  onClick={handleSign}
                >
                  {signing ? 'Signing…' : 'Sign Contract'}
                </button>
              </>
            )}

            {successMessage && !errorMessage && (
              <p className="sign-contract-card__success" role="status">
                {successMessage}
              </p>
            )}

            {!contract.contract_file_url && (
              <div className="sign-contract-card__section">
                <button
                  type="button"
                  className="sign-contract-card__link"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                  disabled={pdfBusy}
                  onClick={handleDownloadPdf}
                >
                  {pdfBusy ? 'Preparing PDF…' : isSigned ? 'Download signed copy (PDF)' : 'Download a copy (PDF)'}
                </button>
                {pdfError && <p className="sign-contract-card__error" role="alert">{pdfError}</p>}
              </div>
            )}
          </>
        ) : (
          <p className="sign-contract-card__error" role="alert">
            Contract not found.
          </p>
        )}
      </div>
    </section>
  )
}

export default SignContract

