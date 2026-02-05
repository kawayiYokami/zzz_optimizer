/**
 * 装备管理服务
 *
 * 负责音擎和驱动盘的装备/卸载操作
 */

import type { SaveDataZod } from '../model/save-data-zod';
import type { SaveData } from '../model/save-data-instance';
import { PropertyType } from '../model/base';

/**
 * 装备管理服务
 */
class EquipmentService {
  private static instance: EquipmentService;

  private constructor() {}

  static getInstance(): EquipmentService {
    if (!EquipmentService.instance) {
      EquipmentService.instance = new EquipmentService();
    }
    return EquipmentService.instance;
  }

  /**
   * 装备音擎到角色
   * @param save 存档实例
   * @param rawSave 原始存档数据
   * @param agentId 角色ID
   * @param wengineId 音擎ID（null 表示卸下）
   * @returns 是否成功
   */
  equipWengine(
    save: SaveData,
    rawSave: SaveDataZod,
    agentId: string,
    wengineId: string | null
  ): boolean {
    const agent = save.getAgent(agentId);
    if (!agent) {
      return false;
    }

    // 修改实例对象
    agent.equipped_wengine = wengineId;

    // 更新 rawSave 中的数据
    const character = rawSave.characters?.find(c => c.id === agentId);
    if (character) {
      character.equippedWengine = wengineId || '';

      // 更新音擎的装备状态
      if (agent.equipped_wengine) {
        // 查找并更新之前装备的音擎
        const oldWengine = rawSave.wengines?.find(w => w.location === agentId);
        if (oldWengine) {
          oldWengine.location = '';
        }

        // 更新新装备的音擎
        const newWengine = rawSave.wengines?.find(w => w.id === wengineId);
        if (newWengine) {
          newWengine.location = agentId;
        }
      }
    }

    return true;
  }

  /**
   * 装备驱动盘到角色
   * @param save 存档实例
   * @param rawSave 原始存档数据
   * @param agentId 角色ID
   * @param diskId 驱动盘ID（null 表示卸下所有）
   * @returns 是否成功
   */
  equipDriveDisk(
    save: SaveData,
    rawSave: SaveDataZod,
    agentId: string,
    diskId: string | null
  ): boolean {
    const agent = save.getAgent(agentId);
    if (!agent) {
      return false;
    }

    // 调用 Agent 类的 equipDriveDisk 方法（自动根据驱动盘位置装备）
    if (diskId) {
      agent.equipDriveDisk(diskId);

      // 更新 rawSave 中的驱动盘 location
      if (rawSave.discs) {
        // 只清除该角色当前装备位置的驱动盘（不是所有位置）
        const diskToEquip = rawSave.discs.find(d => d.id === diskId);
        if (diskToEquip) {
          // 从 slotKey 转换为 position
          const position = parseInt(diskToEquip.slotKey.replace('slot', ''));

          rawSave.discs.forEach(disk => {
            const diskPosition = parseInt(disk.slotKey.replace('slot', ''));
            if (disk.location === agentId && diskPosition === position) {
              disk.location = '';
            }
          });
          diskToEquip.location = agentId;
        } else {
          console.warn(`[EquipmentService] 找不到驱动盘: ${diskId}`);
          return false;
        }
      }
    } else {
      // 卸下驱动盘
      if (rawSave.discs) {
        rawSave.discs.forEach(disk => {
          if (disk.location === agentId) {
            disk.location = '';
          }
        });
      }
    }

    return true;
  }

  /**
   * 同步实例数据到原始存档数据
   * 确保 rawSave 始终与实例数据保持一致
   */
  syncInstanceToRaw(save: SaveData, rawSave: SaveDataZod): void {
    // 同步角色数据
    save.getAllAgents().forEach(agent => {
      const character = rawSave.characters?.find(c => c.id === agent.id);
      if (character) {
        // 更新角色基本信息
        character.level = agent.level;
        character.promotion = agent.breakthrough;
        character.mindscape = agent.cinema;
        character.core = agent.core_skill;
        character.basic = agent.skills.normal;
        character.dodge = agent.skills.dodge;
        character.assist = agent.skills.assist;
        character.special = agent.skills.special;
        character.chain = agent.skills.chain;

        // 更新装备信息
        character.equippedWengine = agent.equipped_wengine || '';

        // 更新驱动盘装备
        const discs: Record<string, string> = {
          '1': agent.equipped_drive_disks[0] || '',
          '2': agent.equipped_drive_disks[1] || '',
          '3': agent.equipped_drive_disks[2] || '',
          '4': agent.equipped_drive_disks[3] || '',
          '5': agent.equipped_drive_disks[4] || '',
          '6': agent.equipped_drive_disks[5] || '',
        };
        character.equippedDiscs = discs;

        // 同步有效词条
        character.effectiveStats = agent.effective_stats.map(stat => PropertyType[stat]);

        // 同步目标套装配置
        character.targetFourPieceSetId = agent.target_four_piece_set_id || undefined;
        character.targetTwoPieceSetIds = agent.target_two_piece_set_ids.length > 0
          ? agent.target_two_piece_set_ids
          : undefined;
      }
    });

    // 同步音擎数据
    save.getAllWEngines().forEach(wengine => {
      const rawWengine = rawSave.wengines?.find(w => w.id === wengine.id);
      if (rawWengine) {
        rawWengine.level = wengine.level;
        rawWengine.modification = wengine.refinement;
        rawWengine.promotion = wengine.breakthrough;
        rawWengine.location = wengine.equipped_agent || '';
      }
    });

    // 同步驱动盘数据
    save.getAllDriveDisks().forEach(disk => {
      const rawDisk = rawSave.discs?.find(d => d.id === disk.id);
      if (rawDisk) {
        rawDisk.level = disk.level;
        rawDisk.location = disk.equipped_agent || '';
        rawDisk.lock = disk.locked;
        rawDisk.trash = disk.trash;
      }
    });

    // 同步队伍数据
    rawSave.teams = save.getAllTeams();

    // 同步战场数据
    rawSave.battles = save.getAllBattles();
  }
}

export const equipmentService = EquipmentService.getInstance();
