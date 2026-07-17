import { render, bodyToHtml, SAMPLE } from '../lib/template'

// Contenido de la burbuja de vista previa de una plantilla.
export default function TemplatePreview({ tpl }) {
  const cuerpo = render(bodyToHtml(tpl.cuerpo || ''), SAMPLE)
  return (
    <div className="hp-card">
      <div className="hp-name">{tpl.nombre}</div>
      <div className="hp-subject">
        <span className="muted">Asunto:</span> {render(tpl.asunto || '', SAMPLE) || '—'}
      </div>
      {cuerpo
        ? <div className="hp-body preview-body" dangerouslySetInnerHTML={{ __html: cuerpo }} />
        : <div className="hp-body muted">— sin contenido —</div>}
    </div>
  )
}
