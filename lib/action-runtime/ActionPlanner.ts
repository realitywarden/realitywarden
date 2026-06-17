import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { ActionPlan } from './ActionPlan';
import type { DeviceState } from './ActionState';
import type { DeviceActionModel } from './DeviceActionModel';
import { RobotArmActionModel } from './models/RobotArmActionModel';
import { MobileRobotActionModel } from './models/MobileRobotActionModel';
import { SmartLightActionModel } from './models/SmartLightActionModel';
import { CameraSensorActionModel } from './models/CameraSensorActionModel';
import { ConveyorBeltActionModel } from './models/ConveyorBeltActionModel';
import { PlcCabinetActionModel } from './models/PlcCabinetActionModel';
import { LabInstrumentActionModel } from './models/LabInstrumentActionModel';
import { WarehouseRackActionModel } from './models/WarehouseRackActionModel';
import { SensorBoxActionModel } from './models/SensorBoxActionModel';

const models: Record<string, DeviceActionModel> = {
  robot_arm: new RobotArmActionModel(),
  mobile_robot: new MobileRobotActionModel(),
  smart_light: new SmartLightActionModel(),
  camera_sensor: new CameraSensorActionModel(),
  conveyor_belt: new ConveyorBeltActionModel(),
  plc_cabinet: new PlcCabinetActionModel(),
  lab_instrument: new LabInstrumentActionModel(),
  warehouse_rack: new WarehouseRackActionModel(),
  sensor_box: new SensorBoxActionModel()
};

export class ActionPlanner {
  plan(command: AdapterCommand, deviceMeta: DeviceMeta, geometry: DeviceGeometry, currentState: DeviceState): ActionPlan {
    return models[deviceMeta.device_type].plan({ command, deviceMeta, geometry, currentState });
  }
}
