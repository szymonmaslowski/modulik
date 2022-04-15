import {
  ActionObject,
  EventObject,
  PureAction,
  SingleOrArray,
} from 'xstate/lib/types';

declare module 'xstate/lib/actions' {
  function pure<TContext, TEvent extends EventObject>(
    getActions: (
      context: TContext,
      event: TEvent,
    ) => SingleOrArray<ActionObject<TContext, TEvent>> | undefined | void,
  ): PureAction<TContext, TEvent>;
}
