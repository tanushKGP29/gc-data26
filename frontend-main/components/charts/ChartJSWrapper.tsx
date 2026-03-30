// @ts-nocheck
import { useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

import { useEffect } from "react";

const cjsInstances = {};

function useChartJs(id, config, deps) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (cjsInstances[id]) {
      cjsInstances[id].destroy();
      delete cjsInstances[id];
    }
    cjsInstances[id] = new Chart(canvasRef.current, config);
    return () => {
      if (cjsInstances[id]) {
        cjsInstances[id].destroy();
        delete cjsInstances[id];
      }
    };
  }, deps);
  return canvasRef;
}

export default useChartJs;
