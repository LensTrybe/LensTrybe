import { useState } from 'react'
import Ask from './Ask'
import ProfilePanel from './ProfilePanel'

// The home page is the ask. Everything else lives on How it works.
export default function Home() {
  const [open, setOpen] = useState(null)
  return (
    <>
      <Ask onOpen={setOpen} />
      <ProfilePanel c={open} onClose={() => setOpen(null)} />
    </>
  )
}
