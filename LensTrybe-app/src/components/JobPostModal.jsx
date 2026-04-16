import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { budgetStoredFromInput } from '../lib/jobPricing.js'

export const JOB_CREATIVE_TYPES = [
  'Photographer',
  'Videographer',
  'Drone Pilot',
  'Video Editor',
  'Photo Editor',
  'Social Media Manager',
  'Hair & Makeup Artist',
  'UGC Creator',
]

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #2a2a36',
  background: '#0f0f14',
  color: '#f2f2f2',
  fontSize: 14,
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 6 }

/**
 * @param {{ open: boolean, onClose: () => void, onPosted?: () => void, accentColor?: string, successMessage?: string }} props
 */
export default function JobPostModal({
  open,
  onClose,
  onPosted,
  accentColor = '#39ff14',
  successMessage = 'Your job has been posted!',
}) {
  const [title, setTitle] = useState('')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [specialty, setSpecialty] = useState('')
  const [location, setLocation] = useState('')
  const [jobDate, setJobDate] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')

  const resetForm = () => {
    setTitle('')
    setSelectedTypes([])
    setSpecialty('')
    setLocation('')
    setJobDate('')
    setBudgetRange('')
    setDescription('')
    setFormError('')
  }

  useEffect(() => {
    if (open) resetForm()
  }, [open])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const toggleType = (t) => {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!supabase) {
      setFormError('Supabase is not configured.')
      return
    }
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) {
      setFormError('You must be signed in to post a job.')
      return
    }
    if (!title.trim()) {
      setFormError('Job title is required.')
      return
    }
    if (selectedTypes.length === 0) {
      setFormError('Select at least one creative type.')
      return
    }
    if (!description.trim()) {
      setFormError('Description is required.')
      return
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    setSubmitting(true)
    try {
      const row = {
        posted_by: user.id,
        title: title.trim(),
        creative_types: selectedTypes,
        specialty: specialty.trim() || null,
        location: location.trim() || null,
        job_date: jobDate || null,
        budget_range: budgetStoredFromInput(budgetRange),
        description: description.trim(),
        status: 'active',
        expires_at: expiresAt.toISOString(),
      }
      const { error } = await supabase.from('job_listings').insert(row)
      if (error) throw new Error(error.message)
      onClose()
      resetForm()
      onPosted?.()
      setToast(successMessage)
    } catch (err) {
      setFormError(err?.message ? String(err.message) : 'Could not post job.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return toast ? (
      <div
        role="status"
        style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1a2e1a',
          border: `1px solid ${accentColor}`,
          color: '#e8ffe8',
          padding: '12px 20px',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          zIndex: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {toast}
      </div>
    ) : null
  }

  return (
    <>
      <div
        role="presentation"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.72)',
          zIndex: 350,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          boxSizing: 'border-box',
        }}
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) onClose()
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-post-title"
          style={{
            background: '#111118',
            border: '1px solid #2a2a36',
            borderRadius: 14,
            padding: 24,
            maxWidth: 520,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
          onClick={(ev) => ev.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 id="job-post-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              Post a job
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                fontSize: 22,
                lineHeight: 1,
                cursor: 'pointer',
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="jp-title" style={labelStyle}>
                Job title <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input id="jp-title" value={title} onChange={(ev) => setTitle(ev.target.value)} style={inputStyle} />
            </div>

            <fieldset style={{ border: 'none', margin: '0 0 14px', padding: 0 }}>
              <legend style={{ ...labelStyle, marginBottom: 8 }}>Creative type needed *</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {JOB_CREATIVE_TYPES.map((t) => (
                  <label
                    key={t}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      color: '#ccc',
                      cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" checked={selectedTypes.includes(t)} onChange={() => toggleType(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="jp-specialty" style={labelStyle}>
                Specialty required
              </label>
              <input id="jp-specialty" value={specialty} onChange={(ev) => setSpecialty(ev.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="jp-location" style={labelStyle}>
                Location
              </label>
              <input id="jp-location" value={location} onChange={(ev) => setLocation(ev.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="jp-date" style={labelStyle}>
                Date of job
              </label>
              <input id="jp-date" type="date" value={jobDate} onChange={(ev) => setJobDate(ev.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="jp-budget" style={labelStyle}>
                Budget range
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  borderRadius: 8,
                  border: '1px solid #2a2a36',
                  background: '#0f0f14',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    color: '#aaa',
                    fontSize: 14,
                    fontWeight: 600,
                    borderRight: '1px solid #2a2a36',
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  $
                </span>
                <input
                  id="jp-budget"
                  value={budgetRange}
                  onChange={(ev) => setBudgetRange(ev.target.value)}
                  style={{
                    ...inputStyle,
                    border: 'none',
                    borderRadius: 0,
                    flex: 1,
                    minWidth: 0,
                  }}
                  placeholder="500 - 1,000"
                />
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>Amounts are shown with a $ prefix.</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="jp-desc" style={labelStyle}>
                Description <span style={{ color: '#f87171' }}>*</span>
              </label>
              <textarea
                id="jp-desc"
                value={description}
                onChange={(ev) => setDescription(ev.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
              />
            </div>

            {formError ? <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{formError}</div> : null}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                background: accentColor,
                color: '#000',
                fontWeight: 800,
                border: 'none',
                borderRadius: 8,
                padding: '14px 18px',
                fontSize: 15,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting ? 0.75 : 1,
              }}
            >
              {submitting ? 'Posting…' : 'Post Job'}
            </button>
          </form>
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a2e1a',
            border: `1px solid ${accentColor}`,
            color: '#e8ffe8',
            padding: '12px 20px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 400,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      ) : null}
    </>
  )
}
