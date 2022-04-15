const greet = (name: string) => `Hello you, ${name}!`;

export type Greet = typeof greet;

export default greet;
