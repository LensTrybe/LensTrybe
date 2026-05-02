import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './SignContract.css'

function SignContract() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [contract, setContract] = useState(null)
  const [businessName, setBusinessName] = useState('')

  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
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

      const {
        data: contractRow,
        error: contractError,
      } = await supabase
        .from('contracts')
        .select('*')
        .eq('signing_token', token)
        .maybeSingle()

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

      const creativeId = contractRow.creative_id

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', creativeId)
        .eq('is_admin', false)
        .maybeSingle()

      if (!cancelled) {
        setContract(contractRow)
        setBusinessName(
          !profileError && profile?.business_name?.trim()
            ? profile.business_name.trim()
            : '',
        )
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [token])

  const handleSign = async () => {
    if (!supabase || !contract || !token) return
    if (isSigned) return
    if (!agreed) return
    if (signing) return

    setSigning(true)
    setErrorMessage('')
    setSuccessMessage('')

    const { error } = await supabase
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .eq('id', contract.id)
      .eq('signing_token', token)

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

