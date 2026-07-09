export default function Spinner({ lg = false, light = false }) {
  return <span className={'spinner' + (lg ? ' lg' : '') + (light ? ' light' : '')} aria-hidden="true" />
}
