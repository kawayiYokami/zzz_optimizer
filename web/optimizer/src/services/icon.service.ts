/**
 * 图标服务
 * 负责统一管理和获取游戏内各种资源的图标 URL
 */

import { DataLoaderService } from './data-loader.service';

const ASSETS_BASE_URL = '/game-data/icons';

export enum CharacterIconType {
  AVATAR = 'avatar', // 标准头像 (IconRoleXX)
  CIRCLE = 'circle', // 圆形头像 (IconRoleCircleXX)
  CROP = 'crop',     // 半身像 (IconRoleCropXX)
}

export class IconService {
  private static instance: IconService;

  private constructor() {}

  public static getInstance(): IconService {
    if (!IconService.instance) {
      IconService.instance = new IconService();
    }
    return IconService.instance;
  }

  /**
   * 获取角色图标
   * @param iconCode 角色图标代码 (如 "IconRole09")
   * @param type 图标类型 (avatar, circle, crop)
   */
  public getCharacterIconUrl(iconCode: string, type: CharacterIconType = CharacterIconType.AVATAR): string {
    console.log('[IconService.getCharacterIconUrl] Input:', { iconCode, type });
    
    if (!iconCode) {
      console.warn('[IconService.getCharacterIconUrl] Empty iconCode provided');
      return '';
    }

    // 移除可能的路径和扩展名
    let filename = this.extractFilename(iconCode);
    console.log('[IconService.getCharacterIconUrl] Extracted filename:', filename);

    // 根据类型调整文件名
    // 假设基础 filename 是 "IconRoleXX"
    if (filename.startsWith('IconRole')) {
      switch (type) {
        case CharacterIconType.CIRCLE:
          if (!filename.startsWith('IconRoleCircle')) {
            filename = filename.replace('IconRole', 'IconRoleCircle');
          }
          break;
        case CharacterIconType.CROP:
          if (!filename.startsWith('IconRoleCrop')) {
            filename = filename.replace('IconRole', 'IconRoleCrop');
          }
          break;
        case CharacterIconType.AVATAR:
        default:
          // 确保不包含 Circle 或 Crop (如果传入的是 Circle/Crop 的名字但请求 Avatar)
          // 这里简单的替换可能不够，如果传入的是 IconRoleCircle09，要转回 IconRole09
          if (filename.startsWith('IconRoleCircle')) {
            filename = filename.replace('IconRoleCircle', 'IconRole');
          } else if (filename.startsWith('IconRoleCrop')) {
            filename = filename.replace('IconRoleCrop', 'IconRole');
          }
          break;
      }
    }

    const finalUrl = `${ASSETS_BASE_URL}/${filename}.webp`;
    console.log('[IconService.getCharacterIconUrl] Final URL:', finalUrl);
    return finalUrl;
  }

  /**
   * 获取角色头像图标（标准方形）
   * @param characterId 角色游戏ID
   */
  public getCharacterAvatarById(characterId: string): string {
    return this.getCharacterIconById(characterId, CharacterIconType.AVATAR);
  }

  /**
   * 获取角色圆形图标
   * @param characterId 角色游戏ID
   */
  public getCharacterCircleById(characterId: string): string {
    return this.getCharacterIconById(characterId, CharacterIconType.CIRCLE);
  }

  /**
   * 获取角色半身像图标（用于卡片背景）
   * @param characterId 角色游戏ID
   */
  public getCharacterCropById(characterId: string): string {
    return this.getCharacterIconById(characterId, CharacterIconType.CROP);
  }

  /**
   * 通过角色ID获取图标（内部方法）
   * @param characterId 角色游戏ID
   * @param type 图标类型
   */
  private getCharacterIconById(characterId: string, type: CharacterIconType): string {
    console.log('[IconService.getCharacterIconById] Input:', { characterId, type });
    
    const dataLoader = DataLoaderService.getInstance();
    const character = dataLoader.characterData?.get(characterId);
    
    if (!character) {
      console.warn('[IconService.getCharacterIconById] Character not found:', characterId);
      return '';
    }
    
    if (!character.icon) {
      console.warn('[IconService.getCharacterIconById] Character has no icon:', characterId, character);
      return '';
    }
    
    console.log('[IconService.getCharacterIconById] Character icon:', character.icon);
    return this.getCharacterIconUrl(character.icon, type);
  }

  /**
   * 获取音擎(武器)图标
   * @param iconCode 音擎图标代码 (如 "Weapon_A_1081")
   */
  public getWeaponIconUrl(iconCode: string): string {
    if (!iconCode) return '';
    const filename = this.extractFilename(iconCode);
    return `${ASSETS_BASE_URL}/${filename}.webp`;
  }

  /**
   * 通过音擎ID获取图标
   * @param weaponId 音擎ID
   */
  public getWeaponIconById(weaponId: string): string {
    const dataLoader = DataLoaderService.getInstance();
    const weapon = dataLoader.weaponData?.get(weaponId);
    
    // 如果找到了数据且有icon字段，直接使用
    if (weapon && weapon.icon) {
      return this.getWeaponIconUrl(weapon.icon);
    }

    // Fallback logic from image-helper.ts
    // 如果 ID 包含 "Weapon_" 前缀，直接使用
    if (weaponId.startsWith('Weapon_')) {
      return `${ASSETS_BASE_URL}/${weaponId}.webp`;
    }
    
    // 尝试构造 S 级图标作为默认
    return `${ASSETS_BASE_URL}/Weapon_S_${weaponId}.webp`;
  }

  /**
   * 获取驱动盘(装备)图标
   * @param iconPath 完整图标路径 (如 "UI/Sprite/.../SuitWhiteWaterBallad.png")
   */
  public getEquipmentIconUrl(iconPath: string): string {
    if (!iconPath) return '';
    const filename = this.extractFilename(iconPath);
    return `${ASSETS_BASE_URL}/${filename}.webp`;
  }

  /**
   * 通过驱动盘ID获取图标
   * @param equipmentId 驱动盘ID
   */
  public getEquipmentIconById(equipmentId: string): string {
    const dataLoader = DataLoaderService.getInstance();
    const equipment = dataLoader.equipmentData?.get(equipmentId);
    if (!equipment || !equipment.icon) {
      return '';
    }
    return this.getEquipmentIconUrl(equipment.icon);
  }

  /**
   * 获取邦布图标
   * @param iconPath 完整图标路径
   */
  public getBangbooIconUrl(iconPath: string): string {
    if (!iconPath) return '';
    const filename = this.extractFilename(iconPath);
    return `${ASSETS_BASE_URL}/${filename}.webp`;
  }
  
  /**
   * 通过邦布ID获取图标
   * @param bangbooId 邦布ID
   */
  public getBangbooIconById(bangbooId: string): string {
    const dataLoader = DataLoaderService.getInstance();
    
    // 尝试从 bangboo_index.json 获取图标
    const bangbooIndex = dataLoader.bangbooIndexData?.get(bangbooId);
    if (bangbooIndex && bangbooIndex.icon) {
      return this.getBangbooIconUrl(bangbooIndex.icon);
    }

    return '';
  }

  /**
   * 获取敌人图标
   * @param iconPath 完整图标路径
   */
  public getEnemyIconUrl(iconPath: string): string {
    if (!iconPath) return '';
    const filename = this.extractFilename(iconPath);
    return `${ASSETS_BASE_URL}/${filename}.webp`;
  }

  /**
   * 通过敌人ID获取图标
   * @param enemyId 敌人ID
   */
  public getEnemyIconById(enemyId: string): string {
    console.log('[IconService.getEnemyIconById] Input enemyId:', enemyId);
    
    const dataLoader = DataLoaderService.getInstance();
    const enemy = dataLoader.enemyData?.get(enemyId);
    
    if (!enemy) {
      console.warn('[IconService.getEnemyIconById] Enemy not found:', enemyId);
      return '';
    }

    console.log('[IconService.getEnemyIconById] Enemy found:', {
      CHS: enemy.CHS,
      code_name: enemy.code_name,
      full_name: enemy.full_name
    });

    // 优先通过中文名匹配 enemy_index
    const enemyIndexData = dataLoader.enemyIndexData;
    if (enemyIndexData && enemy.CHS) {
      for (const [indexId, entry] of enemyIndexData.entries()) {
        if (entry.CHS === enemy.CHS && entry.icon) {
          console.log('[IconService.getEnemyIconById] Found match by CHS name! Index ID:', indexId, 'Icon:', entry.icon);
          return this.getEnemyIconUrl(entry.icon);
        }
      }
    }

    // 如果中文名没找到，尝试通过 code_name 匹配
    const codeName = enemy.code_name;
    if (codeName && enemyIndexData) {
      for (const entry of enemyIndexData.values()) {
        if (entry.icon && typeof entry.icon === 'string') {
          if (entry.icon.includes(codeName)) {
            console.log('[IconService.getEnemyIconById] Found match by code_name! Icon:', entry.icon);
            return this.getEnemyIconUrl(entry.icon);
          }
        }
      }
    }
    
    // 如果找不到匹配，尝试直接构造
    console.warn('[IconService.getEnemyIconById] No icon found, using fallback for code_name:', codeName);
    return codeName ? `${ASSETS_BASE_URL}/${codeName}.webp` : '';
  }

  /**
   * 获取属性图标
   * @param element 属性名称 (如 "Ice", "Fire", "Electric", "Physical", "Ether")
   */
  public getElementIconUrl(element: string | number): string {
    console.log('[IconService.getElementIconUrl] Input:', element);

    if (!element) {
      console.warn('[IconService.getElementIconUrl] Empty element provided');
      return '';
    }

    let elementStr = String(element);

    // 如果是数字ID，尝试转换 (虽然这里直接用英文名更方便)
    // 200: Physical, 201: Fire, 202: Ice, 203: Electric, 205: Ether
    const idMap: Record<string, string> = {
      '200': 'Physical',
      '201': 'Fire',
      '202': 'Ice',
      '203': 'Electric',
      '205': 'Ether'
    };

    if (idMap[elementStr]) {
      elementStr = idMap[elementStr];
      console.log('[IconService.getElementIconUrl] Converted element ID to name:', elementStr);
    }

    // 首字母大写
    const normalized = elementStr.charAt(0).toUpperCase() + elementStr.slice(1).toLowerCase();
    const finalUrl = `${ASSETS_BASE_URL}/Icon${normalized}.webp`;
    console.log('[IconService.getElementIconUrl] Final URL:', finalUrl);
    return finalUrl;
  }

  /**
   * 获取技能图标
   * @param skillType 技能类型 (e.g., 'normal', 'dodge', 'core')
   */
  public getSkillIconUrl(skillType: string): string {
    const skillIconMap: Record<string, string> = {
      normal: 'Icon_Normal',
      dodge: 'Icon_Evade',
      assist: 'Icon_Switch',
      special: 'Icon_SpecialReady',
      chain: 'Icon_UltimateReady',
      core: 'Icon_CoreSkill',
    };
    const filename = skillIconMap[skillType.toLowerCase()];
    if (filename) {
      return `${ASSETS_BASE_URL}/${filename}.webp`;
    }
    return '';
  }

  /**
   * 获取武器类型图标
   * @param weaponType 武器类型枚举值 (1-6)
   */
  public getWeaponTypeIconUrl(weaponType: number): string {
    const weaponTypeIconMap: Record<number, string> = {
      1: 'IconAttackType',    // 强攻
      2: 'IconStun',          // 击破
      3: 'IconAnomaly',       // 异常
      4: 'IconSupport',       // 支援
      5: 'IconDefense',       // 防护
      6: 'IconRupture',       // 未知类型6
    };
    const filename = weaponTypeIconMap[weaponType];
    if (filename) {
      return `${ASSETS_BASE_URL}/${filename}.webp`;
    }
    return '';
  }

  /**
   * 从路径中提取文件名 (不含扩展名)
   */
  private extractFilename(path: string): string {
    if (!path) return '';
    console.log('[IconService] Extracting filename from:', path);
    // 获取最后一部分
    const basename = path.split('/').pop() || path;
    // 移除扩展名
    const result = basename.replace(/\.(png|jpg|jpeg|webp)$/i, '');
    console.log('[IconService] Extracted filename:', result);
    return result;
  }
}

export const iconService = IconService.getInstance();