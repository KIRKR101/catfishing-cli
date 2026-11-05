import readline from 'node:readline';

export class PromptAbort extends Error {
  constructor(message = 'Cancelled') {
    super(message);
    this.name = 'PromptAbort';
  }
}

export class Prompter {
  constructor({ input = process.stdin, output = process.stdout } = {}) {
    this.input = input;
    this.output = output;
    this.interactive = Boolean(input.isTTY && output.isTTY);

    if (this.interactive) {
      readline.emitKeypressEvents(input);
    } else {
      this.readline = readline.createInterface({
        input,
        crlfDelay: Infinity,
      });
      this.lines = this.readline[Symbol.asyncIterator]();
    }
  }

  async line(prompt) {
    if (!this.interactive) {
      this.output.write(prompt);
      const next = await this.lines.next();
      if (next.done) throw new PromptAbort('End of input');
      this.output.write(`${next.value}\n`);
      return next.value;
    }

    return this.#readInteractive(prompt, { mode: 'line' });
  }

  async key(prompt, { valid = ['y', 'n'], defaultKey = 'n' } = {}) {
    if (!this.interactive) {
      const answer = (await this.line(prompt)).trim().toLowerCase();
      const first = [...answer][0];
      return valid.includes(first) ? first : defaultKey;
    }

    return this.#readInteractive(prompt, { mode: 'key', valid, defaultKey });
  }

  #readInteractive(prompt, { mode, valid = [], defaultKey }) {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let settled = false;
      const validSet = new Set(valid);

      const render = () => {
        this.output.write(`\r\x1b[2K${prompt}${buffer}`);
      };

      const cleanup = () => {
        if (settled) return;
        settled = true;
        this.input.off('keypress', onKey);
        try {
          this.input.setRawMode(false);
        } catch {
          // Ignore terminals that cannot leave raw mode.
        }
        this.input.pause();
      };

      const finish = (value, echo = buffer) => {
        if (settled) return;
        this.output.write(`\r\x1b[2K${prompt}${echo}\r\n`);
        cleanup();
        resolve(value);
      };

      const fail = (error) => {
        if (settled) return;
        this.output.write('\r\n');
        cleanup();
        reject(error);
      };

      const onKey = (sequence, key = {}) => {
        if (key.ctrl && key.name === 'c') {
          this.output.write('^C');
          fail(new PromptAbort());
          return;
        }

        if (key.name === 'return' || key.name === 'enter' || sequence === '\r' || sequence === '\n') {
          if (mode === 'key') finish(defaultKey, defaultKey);
          else finish(buffer);
          return;
        }

        if (mode === 'key') {
          const char = (sequence || '').toLowerCase();
          if (validSet.has(char)) finish(char, char);
          return;
        }

        if (key.name === 'backspace') {
          buffer = [...buffer].slice(0, -1).join('');
          render();
          return;
        }

        if (key.name === 'escape') {
          buffer = '';
          render();
          return;
        }

        if (key.ctrl || key.meta || !sequence) return;
        if (/[\x00-\x1f\x7f]/.test(sequence) || sequence.startsWith('\x1b')) return;
        buffer += sequence;
        render();
      };

      try {
        this.input.setRawMode(true);
      } catch {
        fail(new PromptAbort('This terminal does not support interactive input.'));
        return;
      }

      this.input.on('keypress', onKey);
      this.input.resume();
      render();
    });
  }

  close() {
    if (this.readline) this.readline.close();
  }
}
