// Skeletons (26 Oct 2026): grey shapes the size of what is loading, so a screen keeps its layout
// instead of showing "Loading". The shapes use .sk from base.css; screen readers hear the label.
const live = label => ({ role: 'status', 'aria-busy': true, 'aria-label': label })

// Lines of text, like a paragraph or a short note.
export function SkLines({ n = 3, label = 'Loading' }) {
  return <div {...live(label)} style={{ display: 'grid', gap: 10, maxWidth: 560 }}>{Array.from({ length: n }, (_, i) => <span key={i} className="sk t" style={{ width: [92, 78, 60, 84, 70][i % 5] + '%' }} />)}</div>
}
// Rows in a list: a round picture and two lines, like threads, chats or bookings.
export function SkRows({ n = 4, label = 'Loading' }) {
  return <div {...live(label)} style={{ display: 'grid', gap: 18, padding: '6px 2px' }}>{Array.from({ length: n }, (_, i) => (
    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}><span className="sk c" style={{ width: 40, height: 40, flex: 'none' }} /><div style={{ flex: 1, display: 'grid', gap: 8 }}><span className="sk t" style={{ width: [55, 40, 62, 48][i % 4] + '%' }} /><span className="sk t" style={{ width: [80, 70, 88, 64][i % 4] + '%', opacity: 0.7 }} /></div></div>
  ))}</div>
}
// Cards in a grid: a picture and a couple of lines, like listings or jobs.
export function SkCards({ n = 6, label = 'Loading', min = 240, pic = 150 }) {
  return <div {...live(label)} style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap: 14 }}>{Array.from({ length: n }, (_, i) => (
    <div key={i} style={{ display: 'grid', gap: 10 }}><span className="sk" style={{ height: pic, borderRadius: 18 }} /><span className="sk t" style={{ width: '70%' }} /><span className="sk t" style={{ width: '45%', opacity: 0.7 }} /></div>
  ))}</div>
}
