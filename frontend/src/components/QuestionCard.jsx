import React from 'react'

const optionKeys = [
  { key: 'options_1', label: 'A' },
  { key: 'options_2', label: 'B' },
  { key: 'options_3', label: 'C' },
  { key: 'options_4', label: 'D' }
]

export default function QuestionCard({ item, displayLang = 'both' }) {
  const showAnswerState = React.useState(false)
  const showAnswer = showAnswerState[0]
  const setShowAnswer = showAnswerState[1]
  const [selected, setSelected] = React.useState(null) // option index 1..4
  const currentLang = displayLang || 'both'

  const stripLeadingSerial = (text = '') => {
    try{
      return String(text).replace(/^\s*\d+[\)\.\-\s]*/,'')
    }catch(e){ return text || '' }
  }

  const renderOption = (optKey) => {
    const eng = item[`${optKey}_english`] || ''
    const hin = item[`${optKey}_hindi`] || ''
    const showEng = currentLang === 'english' || currentLang === 'both'
    const showHin = currentLang === 'hindi' || currentLang === 'both'
    if (!eng && !hin) return null
    return (
      <div className="gk-option" key={optKey}>
        {showEng && <div className="gk-option-text">{eng}</div>}
        {showHin && hin && <div className="gk-option-text gk-option-text--hi">{hin}</div>}
      </div>
    )
  }

  // feedback/report removed per request

  return (
    <article className="gk-card">
      <header className="gk-card-head">
        <div />
      </header>

      <div className="gk-question">
        {currentLang !== 'hindi' && (
          <div className="gk-question-line">
            {stripLeadingSerial(item.question_english) || ''}
          </div>
        )}
        {currentLang !== 'english' && (item.question_hindi || item.question_english) && (
          <div className="gk-question-line gk-question-line--hi">
            {stripLeadingSerial(item.question_hindi || item.question_english)}
          </div>
        )}
      </div>

      <ul className="gk-option-list">
        {optionKeys.map(({ key, label }, idx) => {
          const content = renderOption(key)
          if (!content) return null
          const optIndex = idx + 1
          const correctIndex = Number(item.answer || 0)
          const isSelected = selected === optIndex

          // show green tick if this option is the correct one and either it's selected or answers are revealed
          const isCorrect = (optIndex === correctIndex) && (showAnswer || isSelected)
          // show red X immediately when a wrong option is selected
          const isWrongSelected = isSelected && (optIndex !== correctIndex)

          const rowStyle = isCorrect ? { background: '#ecfdf5', borderRadius: 8, padding: '6px' } : (isWrongSelected ? { background: '#fff1f2', borderRadius: 8, padding: '6px' } : undefined)

          const icon = isCorrect ? '✓' : (isWrongSelected ? '✗' : '')

          return (
            <li
              className="gk-option-row"
              key={key}
              onClick={() => { setSelected(optIndex) }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelected(optIndex) } }}
              style={Object.assign({ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 6 }, rowStyle)}
            >
              <span className="gk-option-label" style={{ marginRight: 8 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="gk-option-content">
                <div>{content}</div>
                <span style={{ color: isCorrect ? '#065f46' : '#b91c1c', fontWeight: 700 }}>{icon}</span>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="gk-card-actions">
        <button onClick={() => setShowAnswer((s) => !s)}>{showAnswer ? 'Hide Answer' : 'Show Answer'}</button>
      </div>

      {showAnswer && (() => {
        const ai = Number(item.answer || 0)
        const opt = optionKeys[ai - 1]
        const optText = opt ? (item[`${opt.key}_english`] || item[`${opt.key}_hindi`] || '') : ''
        return (
          <div style={{ marginTop: 8, color: '#065f46', fontWeight: 700 }}>
            Correct Answer, option ({ai}) {optText}
          </div>
        )
      })()}

      {/* feedback/report removed */}
    </article>
  )
}
