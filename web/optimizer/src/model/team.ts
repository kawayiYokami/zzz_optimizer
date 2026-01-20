/**
 * 队伍类
 * 管理队伍成员，包括前台角色和后台角色
 */

import type { Agent } from './agent';
import type { ZodTeamData } from './save-data-zod';
import type { OptimizationConstraints } from '../optimizer/types';

/**
 * 优化配置接口
 */
export interface TeamOptimizationConfig {
  constraints: OptimizationConstraints;
  selectedSkillKeys: string[];
  disabledBuffIds: string[];
  selectedEnemyId: string;
  lastUpdated: string;
}

export class Team {
  private _agents: Agent[] = [];
  private _bond: any | null = null; // 邦布实例暂时留空，使用any类型
  private _id: string;
  private _name: string;
  private _optimizationConfig: TeamOptimizationConfig | undefined;
  private _zodTeamData?: ZodTeamData; // 引用对应的ZodTeamData对象，用于实时同步

  /**
   * 构造函数
   * @param agents 队伍成员列表（1-3个）
   * @param id 队伍ID
   * @param name 队伍名称
   * @param bond 邦布实例（可选）
   * @param optimizationConfig 优化配置（可选）
   * @param zodTeamData ZodTeamData对象引用（可选，用于实时同步）
   */
  constructor(
    agents: Agent[],
    id: string = '',
    name: string = '',
    bond: any | null = null,
    optimizationConfig?: TeamOptimizationConfig,
    zodTeamData?: ZodTeamData
  ) {
    if (agents.length < 1 || agents.length > 3) {
      throw new Error('队伍成员数量必须在1-3个之间');
    }
    this._agents = [...agents];
    this._id = id;
    this._name = name;
    this._bond = bond;
    this._optimizationConfig = optimizationConfig;
    this._zodTeamData = zodTeamData;
  }

  /**
   * 获取队伍ID
   */
  get id(): string {
    return this._id;
  }

  /**
   * 设置队伍ID
   */
  set id(value: string) {
    this._id = value;
  }

  /**
   * 获取队伍名称
   */
  get name(): string {
    return this._name;
  }

  /**
   * 设置队伍名称
   */
  set name(value: string) {
    this._name = value;
  }

  /**
   * 获取优化配置
   */
  get optimizationConfig(): TeamOptimizationConfig | undefined {
    return this._optimizationConfig;
  }

  /**
   * 设置优化配置
   */
  set optimizationConfig(config: TeamOptimizationConfig | undefined) {
    this._optimizationConfig = config;
    // 实时同步到ZodTeamData
    if (this._zodTeamData) {
      this._zodTeamData.optimizationConfig = config;
    }
  }

  /**
   * 获取前台角色
   */
  get frontAgent(): Agent {
    return this._agents[0];
  }

  /**
   * 设置前台角色
   * @param agent 前台角色
   */
  set frontAgent(agent: Agent) {
    if (!this._agents.some(a => a.id === agent.id)) {
      throw new Error('前台角色必须是队伍成员');
    }
    const currentIndex = this._agents.findIndex(a => a.id === agent.id);
    if (currentIndex > 0) {
      // 将角色移到前台位置
      this._agents.splice(currentIndex, 1);
      this._agents.unshift(agent);
    }
  }

  /**
   * 获取后台角色列表（最多2个）
   */
  get backAgents(): Agent[] {
    return this._agents.slice(1);
  }

  /**
   * 获取所有队伍成员
   */
  get allAgents(): Agent[] {
    return [...this._agents];
  }

  /**
   * 获取邦布实例
   */
  get bond(): any | null {
    return this._bond;
  }

  /**
   * 设置邦布实例
   */
  set bond(bond: any | null) {
    this._bond = bond;
  }

  /**
   * 获取队伍成员数量
   */
  get agentCount(): number {
    return this._agents.length;
  }

  /**
   * 检查是否包含指定角色
   */
  hasAgent(agentId: string): boolean {
    return this._agents.some(agent => agent.id === agentId);
  }

  /**
   * 获取指定索引的角色
   */
  getAgentByIndex(index: number): Agent | undefined {
    return this._agents[index];
  }

  /**
   * 从ZodTeamData创建Team实例
   * @param zodTeam ZodTeamData对象
   * @param agentsMap 角色实例Map，用于查找角色
   * @returns Team实例
   */
  static fromZod(zodTeam: ZodTeamData, agentsMap: Map<string, Agent>): Team {
    const agents: Agent[] = [];

    // 添加前台角色
    const frontAgent = agentsMap.get(zodTeam.frontCharacterId);
    if (frontAgent) {
      agents.push(frontAgent);
    }

    // 添加后台角色1
    if (zodTeam.backCharacter1Id) {
      const backAgent1 = agentsMap.get(zodTeam.backCharacter1Id);
      if (backAgent1) {
        agents.push(backAgent1);
      }
    }

    // 添加后台角色2
    if (zodTeam.backCharacter2Id) {
      const backAgent2 = agentsMap.get(zodTeam.backCharacter2Id);
      if (backAgent2) {
        agents.push(backAgent2);
      }
    }

    // 至少需要一个角色
    if (agents.length === 0) {
      throw new Error('队伍必须至少包含一个角色');
    }

    return new Team(agents, zodTeam.id, zodTeam.name, null, zodTeam.optimizationConfig, zodTeam);
  }

  /**
   * 转换为ZodTeamData格式
   * @returns ZodTeamData对象
   */
  toZodData(): ZodTeamData {
    return {
      id: this._id,
      name: this._name,
      frontCharacterId: this._agents[0].id,
      backCharacter1Id: this._agents[1]?.id || '',
      backCharacter2Id: this._agents[2]?.id || '',
      optimizationConfig: this._optimizationConfig
    };
  }

  /**
   * 格式化输出队伍信息
   */
  format(indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    lines.push(`${prefix}【队伍】`);
    lines.push(`${prefix}  ID: ${this._id}`);
    lines.push(`${prefix}  名称: ${this._name}`);
    lines.push(`${prefix}  前台角色: ${this.frontAgent.name_cn} Lv.${this.frontAgent.level} (M${this.frontAgent.cinema})`);
    
    if (this.backAgents.length > 0) {
      lines.push(`${prefix}  后台角色:`);
      this.backAgents.forEach((agent, index) => {
        lines.push(`${prefix}    ${index + 1}. ${agent.name_cn} Lv.${agent.level}`);
      });
    }

    if (this._bond) {
      lines.push(`${prefix}  邦布: ${this._bond.name_cn || '未命名'}`);
    }

    return lines.join('\n');
  }
}