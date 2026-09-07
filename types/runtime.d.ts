interface Fetcher { fetch(request: Request): Promise<Response>; }
interface D1PreparedStatement {
 bind(...values: unknown[]): D1PreparedStatement;
 first<T = Record<string, unknown>>(): Promise<T | null>;
 all<T = Record<string, unknown>>(): Promise<{results:T[];success:boolean;meta:{changes:number}}>; 
 run(): Promise<{success:boolean;meta:{changes:number}}>;
}
interface D1Database { prepare(sql:string):D1PreparedStatement; batch(statements:D1PreparedStatement[]):Promise<unknown[]>; }
declare module 'cloudflare:workers' { export const env: {DB:any;[key:string]:any}; }
