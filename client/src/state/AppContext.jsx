import {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';
import { api } from '../lib/api.js';

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [jobId, setJobId] = useState(() => sessionStorage.getItem('fri.jobId') || null);
  const [job, setJob] = useState(null);
  const [uploads, setUploads] = useState({ fires: null, meteo: null });

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null));
    api.uploadStatus().then(setUploads).catch(() => {});
  }, []);

  useEffect(() => {
    if (jobId) sessionStorage.setItem('fri.jobId', jobId);
    else sessionStorage.removeItem('fri.jobId');
  }, [jobId]);

  const value = useMemo(
    () => ({
      meta,
      jobId,
      setJobId,
      job,
      setJob,
      uploads,
      setUploads,
      refreshUploads: () => api.uploadStatus().then(setUploads).catch(() => {}),
    }),
    [meta, jobId, job, uploads],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp phải nằm trong <AppProvider>');
  return v;
}
