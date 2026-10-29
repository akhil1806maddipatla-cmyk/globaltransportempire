import { globalEventBus } from '../core/EventBus';

export type GameSpeed = 0 | 1 | 2 | 5;

export interface GameDate {
  day: number;
  month: number;
  year: number;
  formatted: string;
}

export class GameClock {
  private speed: GameSpeed = 1;
  private previousSpeed: GameSpeed = 1;
  private isPaused: boolean = false;
  private elapsedGameSeconds: number = 0;
  private dayDurationRealSeconds: number = 4; // 4 real seconds = 1 in-game day at 1x
  private dayCounter: number = 1;
  private monthCounter: number = 1;
  private yearCounter: number = 2026;

  private months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  constructor() {
    this.emitDate();
  }

  public update(realDeltaTime: number): void {
    if (this.isPaused || this.speed === 0) return;

    const gameDelta = realDeltaTime * this.speed;
    this.elapsedGameSeconds += gameDelta;

    if (this.elapsedGameSeconds >= this.dayDurationRealSeconds) {
      const daysToAdvance = Math.floor(this.elapsedGameSeconds / this.dayDurationRealSeconds);
      this.elapsedGameSeconds %= this.dayDurationRealSeconds;

      for (let i = 0; i < daysToAdvance; i++) {
        this.advanceDay();
      }
      this.emitDate();
    }
  }

  private advanceDay(): void {
    this.dayCounter++;
    if (this.dayCounter > 30) {
      this.dayCounter = 1;
      this.monthCounter++;
      if (this.monthCounter > 12) {
        this.monthCounter = 1;
        this.yearCounter++;
      }
    }
  }

  public togglePause(): boolean {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this.isPaused;
  }

  public pause(): void {
    if (!this.isPaused) {
      this.previousSpeed = this.speed > 0 ? this.speed : 1;
      this.speed = 0;
      this.isPaused = true;
      globalEventBus.emit('game:speed_changed', { speed: 0, isPaused: true });
    }
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.speed = this.previousSpeed;
      globalEventBus.emit('game:speed_changed', { speed: this.speed, isPaused: false });
    }
  }

  public setSpeed(newSpeed: GameSpeed): void {
    if (newSpeed === 0) {
      this.pause();
      return;
    }
    this.speed = newSpeed;
    this.isPaused = false;
    globalEventBus.emit('game:speed_changed', { speed: this.speed, isPaused: false });
  }

  public getSpeed(): GameSpeed {
    return this.speed;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getDate(): GameDate {
    const monthName = this.months[this.monthCounter - 1];
    return {
      day: this.dayCounter,
      month: this.monthCounter,
      year: this.yearCounter,
      formatted: `${this.dayCounter} ${monthName} ${this.yearCounter}`,
    };
  }

  private emitDate(): void {
    globalEventBus.emit('game:date_tick', this.getDate());
  }

  public getElapsedTime(): number {
    return this.elapsedGameSeconds;
  }

  public getTimeSpeed(): number {
    return this.speed;
  }

  public getCurrentDate(): Date {
    return new Date(this.yearCounter, this.monthCounter - 1, this.dayCounter);
  }

  public setDate(day: number, month: number, year: number): void {
    this.dayCounter = day;
    this.monthCounter = month;
    this.yearCounter = year;
    this.emitDate();
  }

  public reset(): void {
    this.dayCounter = 1;
    this.monthCounter = 1;
    this.yearCounter = 2026;
    this.elapsedGameSeconds = 0;
    this.speed = 1;
    this.isPaused = false;
    this.emitDate();
  }
}
