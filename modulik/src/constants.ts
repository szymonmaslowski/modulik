import path from 'path';

export const childPath = path.resolve(__dirname, 'child.js');

export const callbackKeyName = 'modulik-callback-id';

export const modulikEventFailed = 'failed';
export const modulikEventReady = 'ready';
export const modulikEventRestart = 'restart';

export const transpilerTypeBabel = 'babel';
export const transpilerTypeTypescript = 'typescript';
