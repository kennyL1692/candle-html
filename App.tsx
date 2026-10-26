import React from 'react';
import { Experience } from './components/Experience';
import { Hud } from './components/Hud';

export default function App() {
  return (
    <div className="app">
      <div className="stage">
        <Experience />
      </div>
      <Hud />
    </div>
  );
}
