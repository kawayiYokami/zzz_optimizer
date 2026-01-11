/**
 * 存档数据模型
 */

import { Agent } from './agent';
import { DriveDisk } from './drive-disk';
import { WEngine } from './wengine';

/**
 * 单个存档数据
 *
 * ⚠️ 重要架构说明：
 * 存档中只存储玩家拥有的物品实例和状态信息：
 * - 角色：等级、突破、影画、技能等级、装备关系
 * - 驱动盘：等级、主副词条强化次数、装备关系
 * - 音擎：等级、精炼、突破、装备关系
 *
 * 所有游戏基础数据（角色基础属性、音擎基础攻击力、驱动盘套装效果等）
 * 都需要从游戏数据文件（character.json, weapon.json, equipment.json）中读取！
 *
 * 存档不应该包含完整的游戏数据，只记录"玩家有什么"和"状态如何"。
 *
 * ID分配规则：
 * - 角色：10001, 10002, 10003...
 * - 驱动盘：20001, 20002, 20003...
 * - 音擎：30001, 30002, 30003...
 */
export class SaveData {
  name: string; // 存档名称
  created_at: Date;
  updated_at: Date;

  // 数据存储（字典键就是实例ID）
  agents: Map<string, Agent>;
  drive_disks: Map<string, DriveDisk>;
  wengines: Map<string, WEngine>;

  // 元数据：ID分配信息
  _metadata: {
    next_agent_id: number;
    next_drive_disk_id: number;
    next_wengine_id: number;
  };

  constructor(name: string) {
    this.name = name;
    this.created_at = new Date();
    this.updated_at = new Date();
    this.agents = new Map();
    this.drive_disks = new Map();
    this.wengines = new Map();
    this._metadata = {
      next_agent_id: 10001,
      next_drive_disk_id: 20001,
      next_wengine_id: 30001,
    };
  }

  /**
   * 序列化为字典
   */
  toDict(): any {
    return {
      name: this.name,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString(),
      agents: Object.fromEntries(
        Array.from(this.agents.entries()).map(([k, v]) => [k, this._agentToDict(v)])
      ),
      drive_disks: Object.fromEntries(
        Array.from(this.drive_disks.entries()).map(([k, v]) => [k, this._diskToDict(v)])
      ),
      wengines: Object.fromEntries(
        Array.from(this.wengines.entries()).map(([k, v]) => [k, this._wengineToDict(v)])
      ),
      _metadata: this._metadata,
    };
  }

  /**
   * 角色序列化（只序列化实例特有数据）
   */
  private _agentToDict(agent: Agent): any {
    return agent.toDict();
  }

  /**
   * 驱动盘序列化（只序列化实例特有数据）
   */
  private _diskToDict(disk: DriveDisk): any {
    return disk.toDict();
  }

  /**
   * 音擎序列化（只序列化实例特有数据）
   *
   * ⚠️ 不序列化游戏基础数据（base_atk、rand_stat、level_data等）
   * 这些需要从 weapon.json 读取。
   */
  private _wengineToDict(wengine: WEngine): any {
    return wengine.toDict();
  }

  /**
   * 从字典反序列化
   */
  static fromDict(data: any): SaveData {
    const save = new SaveData(data.name);
    save.created_at = new Date(data.created_at);
    save.updated_at = new Date(data.updated_at);

    // 加载元数据
    if (data._metadata) {
      save._metadata = data._metadata;
    }

    // 反序列化对象
    if (data.agents) {
      save.agents = new Map();
      for (const [k, v] of Object.entries(data.agents)) {
        const agent = Agent.fromDict(v);
        // 设置ID为字典键
        agent.id = k;
        save.agents.set(k, agent);
      }
    }

    if (data.drive_disks) {
      save.drive_disks = new Map();
      for (const [k, v] of Object.entries(data.drive_disks)) {
        const disk = DriveDisk.fromDict(v);
        // 设置ID为字典键
        disk.id = k;
        save.drive_disks.set(k, disk);
      }
    }

    if (data.wengines) {
      save.wengines = new Map();
      for (const [k, v] of Object.entries(data.wengines)) {
        const wengine = WEngine.fromDict(v);
        // 设置ID为字典键
        wengine.id = k;
        save.wengines.set(k, wengine);
      }
    }

    return save;
  }

  /**
   * 获取下一个角色ID
   */
  getNextAgentId(): string {
    const id = this._metadata.next_agent_id.toString();
    this._metadata.next_agent_id++;
    return id;
  }

  /**
   * 获取下一个驱动盘ID
   */
  getNextDriveDiskId(): string {
    const id = this._metadata.next_drive_disk_id.toString();
    this._metadata.next_drive_disk_id++;
    return id;
  }

  /**
   * 获取下一个音擎ID
   */
  getNextWEngineId(): string {
    const id = this._metadata.next_wengine_id.toString();
    this._metadata.next_wengine_id++;
    return id;
  }

  /**
   * 添加角色
   */
  addAgent(agent: Agent): void {
    if (!agent.id) {
      agent.id = this.getNextAgentId();
    }
    this.agents.set(agent.id, agent);
    this.updated_at = new Date();
  }

  /**
   * 添加驱动盘
   */
  addDriveDisk(disk: DriveDisk): void {
    if (!disk.id) {
      disk.id = this.getNextDriveDiskId();
    }
    this.drive_disks.set(disk.id, disk);
    this.updated_at = new Date();
  }

  /**
   * 添加音擎
   */
  addWEngine(wengine: WEngine): void {
    if (!wengine.id) {
      wengine.id = this.getNextWEngineId();
    }
    this.wengines.set(wengine.id, wengine);
    this.updated_at = new Date();
  }

  /**
   * 删除角色
   */
  removeAgent(agentId: string): boolean {
    const result = this.agents.delete(agentId);
    if (result) {
      this.updated_at = new Date();
    }
    return result;
  }

  /**
   * 删除驱动盘
   */
  removeDriveDisk(diskId: string): boolean {
    const result = this.drive_disks.delete(diskId);
    if (result) {
      this.updated_at = new Date();
    }
    return result;
  }

  /**
   * 删除音擎
   */
  removeWEngine(wengineId: string): boolean {
    const result = this.wengines.delete(wengineId);
    if (result) {
      this.updated_at = new Date();
    }
    return result;
  }

  /**
   * 获取角色
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 获取驱动盘
   */
  getDriveDisk(diskId: string): DriveDisk | undefined {
    return this.drive_disks.get(diskId);
  }

  /**
   * 获取音擎
   */
  getWEngine(wengineId: string): WEngine | undefined {
    return this.wengines.get(wengineId);
  }

  /**
   * 获取所有角色
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取所有驱动盘
   */
  getAllDriveDisks(): DriveDisk[] {
    return Array.from(this.drive_disks.values());
  }

  /**
   * 获取所有音擎
   */
  getAllWEngines(): WEngine[] {
    return Array.from(this.wengines.values());
  }
}