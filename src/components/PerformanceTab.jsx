import React, { useState, useMemo } from 'react'
import { mapToEcpState } from '../ecpStateMapper'
import { postSimulate } from '../api/simulate'
import EnvelopeMirror from './EnvelopeMirror'
import GeometryInputs from './GeometryInputs'
import PerfResults from './PerfResults'
import HouseElevation from './HouseElevation'

const FDWR_MIN = 0.05
const FDWR_MAX = 0.40

export default function PerformanceTab({ selections, wallSelection, wallRsi, geometry, onGeometryChange }) {
  const [result, setResult] = useState({ status: 'idle', data: null, error: null })
  const [fdwrError, setFdwrError] = useState(null)

  const { ecp_state, sources } = useMemo(
    () => mapToEcpState({ selections, wallSelection, wallRsi }),
    [selections, wallSelection, wallRsi],
  )

  const onChange = (field, value) => {
    onGeometryChange(field, value)
    if (field === 'fdwr') setFdwrError(null)
  }

  const run = async () => {
    if (geometry.fdwr < FDWR_MIN || geometry.fdwr > FDWR_MAX) {
      setFdwrError(`FDWR must be ${FDWR_MIN}–${FDWR_MAX}`)
      return
    }
    if (result.status === 'running') return
    setResult({ status: 'running', data: null, error: null })
    try {
      const data = await postSimulate({
        ecp_state,
        geometry: {
          footprint: { length_m: geometry.length_m, width_m: geometry.width_m },
          fdwr: geometry.fdwr,
        },
        perf_extras: { heating: { type: 'electric_baseboard', efficiency: 1.0 } },
      })
      setResult({ status: 'done', data, error: null })
    } catch (e) {
      // 422/bounds carry a useful detail; other statuses get a generic message.
      const msg = e.status === 422 ? e.message : 'Simulation failed — please try again.'
      setResult({ status: 'error', data: null, error: msg })
    }
  }

  return (
    <div className="performance-tab">
      <div className="performance-inputs">
        <EnvelopeMirror ecpState={ecp_state} sources={sources} />
        <GeometryInputs geometry={geometry} onChange={onChange} fdwrError={fdwrError} />
        <button
          className="run-button"
          onClick={run}
          disabled={result.status === 'running'}
        >
          ▶ Run simulation
        </button>
        <div className="run-hint">~8–15 s · inputs stay editable while it runs</div>
      </div>
      <div className="performance-output">
        <HouseElevation lengthM={geometry.length_m} widthM={geometry.width_m} fdwr={geometry.fdwr} />
        <PerfResults result={result} />
      </div>
    </div>
  )
}
