export class DummyServer {
    storage = new Map<number, string[]>();
    version = 0;

    constructor(data?: string[]) {
        if (data) {
            this.receive(data)
        }
    }

    receive(data: string[]) {
        this.version += Math.floor(Math.random() * 100)
        this.storage.set(this.version, data)
    }

    respond(since: number): { data: string[]; version: number}  {
        const data = Array.from(this.storage.entries())
            .filter(([id, _data]) => id >= since)
            .map(([_id, data]) => data)
            .flat()
        return { data, version: this.version }
    }
}
