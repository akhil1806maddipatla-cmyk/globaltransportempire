import { globalEventBus } from '../core/EventBus';
import { GameClock } from './GameClock';
import { DEFAULT_GAME_CONFIG } from '../app/GameConfig';

export interface GameStateData {
  companyName: string;
  cash: number;
  currency: string;
  selectedEntityId: string | null;
  activeTool: string | null;
  buildingCount: number;
  roadSegmentCount: number;
  vehicleCount: number;
  level: number;
  experience: number;
  unlockedFeatures: string[];
  completedTasks: string[];
  totalIncome: number;
  totalExpenses: number;
}

export class GameState {
  private data: GameStateData;
  public readonly clock: GameClock;

  constructor() {
    this.clock = new GameClock();
    this.data = {
      companyName: DEFAULT_GAME_CONFIG.company.companyName,
      cash: DEFAULT_GAME_CONFIG.company.startingCash,
      currency: DEFAULT_GAME_CONFIG.company.currency,
      selectedEntityId: null,
      activeTool: null,
      buildingCount: 0,
      roadSegmentCount: 0,
      vehicleCount: 0,
      level: 1,
      experience: 0,
      unlockedFeatures: ['basic_road', 'rigid_truck', 'starter_depot', 'two_lane_urban'],
      completedTasks: [],
      totalIncome: 0,
      totalExpenses: 0,
    };
  }

  public getData(): Readonly<GameStateData> {
    return { ...this.data, unlockedFeatures: [...this.data.unlockedFeatures], completedTasks: [...this.data.completedTasks] };
  }

  // --- Financial & Treasury System ---

  public getCash(): number {
    return this.data.cash;
  }

  public setCash(amount: number): void {
    const prev = this.data.cash;
    this.data.cash = Math.max(0, amount);
    if (amount > prev) {
      this.data.totalIncome += (amount - prev);
    } else if (amount < prev) {
      this.data.totalExpenses += (prev - amount);
    }
    globalEventBus.emit('game:cash_changed', this.data.cash);
  }

  public canAfford(amount: number): boolean {
    return this.data.cash >= amount && amount >= 0;
  }

  public addCash(amount: number, reason: string = 'Revenue'): void {
    if (amount <= 0) return;
    this.data.cash += amount;
    this.data.totalIncome += amount;
    globalEventBus.emit('game:cash_changed', this.data.cash);
    globalEventBus.emit('game:transaction', {
      type: 'income',
      amount,
      reason,
      balance: this.data.cash,
    });
  }

  public deductCash(amount: number, reason: string = 'Expense'): boolean {
    if (amount <= 0) return true;
    if (this.data.cash < amount) {
      return false; // Insufficient funds, never deduct partially or silently
    }
    this.data.cash -= amount;
    this.data.totalExpenses += amount;
    globalEventBus.emit('game:cash_changed', this.data.cash);
    globalEventBus.emit('game:transaction', {
      type: 'expense',
      amount,
      reason,
      balance: this.data.cash,
    });
    return true;
  }

  public getTotalIncome(): number {
    return this.data.totalIncome;
  }

  public getTotalExpenses(): number {
    return this.data.totalExpenses;
  }

  // --- Progression & Experience System ---

  public getLevel(): number {
    return this.data.level;
  }

  public getExperience(): number {
    return this.data.experience;
  }

  public getNextLevelExp(): number {
    return this.data.level * 1000;
  }

  public setLevel(level: number): void {
    this.data.level = Math.max(1, Math.floor(level));
    globalEventBus.emit('game:level_up', { level: this.data.level });
  }

  public setExperience(xp: number): void {
    this.data.experience = Math.max(0, Math.floor(xp));
    globalEventBus.emit('game:experience_gained', {
      experience: this.data.experience,
      level: this.data.level,
      nextLevelExp: this.getNextLevelExp(),
    });
  }

  public addExperience(amount: number): { currentLevel: number; currentExp: number; leveledUp: boolean } {
    if (amount <= 0) {
      return { currentLevel: this.data.level, currentExp: this.data.experience, leveledUp: false };
    }

    this.data.experience += amount;
    let leveledUp = false;

    while (this.data.experience >= this.getNextLevelExp()) {
      this.data.experience -= this.getNextLevelExp();
      this.data.level += 1;
      leveledUp = true;
      globalEventBus.emit('game:level_up', { level: this.data.level });
    }

    globalEventBus.emit('game:experience_gained', {
      experience: this.data.experience,
      level: this.data.level,
      nextLevelExp: this.getNextLevelExp(),
    });

    return {
      currentLevel: this.data.level,
      currentExp: this.data.experience,
      leveledUp,
    };
  }

  // --- Feature Unlocks & Content System ---

  public unlockFeature(featureId: string): boolean {
    if (this.data.unlockedFeatures.includes(featureId)) {
      return false;
    }
    this.data.unlockedFeatures.push(featureId);
    globalEventBus.emit('game:feature_unlocked', { featureId });
    return true;
  }

  public hasUnlock(featureId: string): boolean {
    return this.data.unlockedFeatures.includes(featureId);
  }

  public getUnlockedFeatures(): string[] {
    return [...this.data.unlockedFeatures];
  }

  // --- Completed Tasks & Contract Rewards Invariants ---

  public claimTaskReward(taskId: string, rewardCash: number, rewardXp: number): { success: boolean; error?: string } {
    if (this.data.completedTasks.includes(taskId)) {
      return { success: false, error: `Reward for task '${taskId}' has already been claimed.` };
    }

    this.data.completedTasks.push(taskId);
    if (rewardCash > 0) {
      this.addCash(rewardCash, `Task Reward: ${taskId}`);
    }
    if (rewardXp > 0) {
      this.addExperience(rewardXp);
    }

    globalEventBus.emit('game:task_reward_claimed', {
      taskId,
      rewardCash,
      rewardXp,
      level: this.data.level,
    });

    return { success: true };
  }

  public isTaskCompleted(taskId: string): boolean {
    return this.data.completedTasks.includes(taskId);
  }

  public getCompletedTasks(): string[] {
    return [...this.data.completedTasks];
  }

  // --- Selection & Tool State ---

  public selectEntity(entityId: string | null): void {
    if (this.data.selectedEntityId !== entityId) {
      this.data.selectedEntityId = entityId;
      globalEventBus.emit('selection:changed', entityId);
    }
  }

  public getSelectedEntityId(): string | null {
    return this.data.selectedEntityId;
  }

  public setActiveTool(toolId: string | null): void {
    if (this.data.activeTool !== toolId) {
      this.data.activeTool = toolId;
      globalEventBus.emit('tool:changed', toolId);
    }
  }

  public getActiveTool(): string | null {
    return this.data.activeTool;
  }

  // --- World Counts Synchronization ---

  public updateCounts(buildings: number, roads: number, vehicles?: number): void {
    this.data.buildingCount = buildings;
    this.data.roadSegmentCount = roads;
    if (vehicles !== undefined) {
      this.data.vehicleCount = vehicles;
    }
    globalEventBus.emit('world:counts_changed', {
      buildings: this.data.buildingCount,
      roads: this.data.roadSegmentCount,
      vehicles: this.data.vehicleCount,
    });
  }

  public getVehicleCount(): number {
    return this.data.vehicleCount;
  }

  public update(realDeltaTime: number): void {
    this.clock.update(realDeltaTime);
  }
}
