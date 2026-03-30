// @ts-nocheck
import { useCallback, useState } from "react";

function ToastZone({ toasts, remove }) {
  return (
    <div className="toast-zone">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast t-${t.type}`}
          onClick={() => remove(t.id)}
          style={{ cursor: "pointer" }}
        >
          <div className="toast-lbl">{t.label}</div>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((text, type = "info", label = "Insight") => {
    const id = Date.now();
    setToasts((ts) => [...ts, { id, text, type, label }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 5200);
  }, []);
  const remove = useCallback(
    (id) => setToasts((ts) => ts.filter((t) => t.id !== id)),
    [],
  );
  return [toasts, add, remove];
}


export {useToasts};
export default ToastZone;