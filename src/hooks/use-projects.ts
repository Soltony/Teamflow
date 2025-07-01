
"use client";

import { useState, useEffect, useCallback } from 'react';
import { projects as initialProjects } from '@/lib/data';
import type { Project } from '@/lib/types';

// This is a simplified, in-memory store using a vanilla event emitter pattern.
// It ensures that when data is updated in one component, all other components
// using this hook will re-render with the new data.

type State = {
  projects: Project[];
}

const createStore = (initialState: State) => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (updater: (prevState: State) => State) => {
      state = updater(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const projectStore = createStore({ projects: initialProjects });

// The custom hook that components will use to access and update project data.
export function useProjects() {
  const [state, setState] = useState(projectStore.getState());

  useEffect(() => {
    const unsubscribe = projectStore.subscribe(() => {
      setState(projectStore.getState());
    });
    return unsubscribe;
  }, []);

  const setProjects = useCallback((updater: (prevProjects: Project[]) => Project[]) => {
    projectStore.setState(prevState => ({
      ...prevState,
      projects: updater(prevState.projects),
    }));
  }, []);

  return [state.projects, setProjects] as const;
}
