export interface FabricSettings<SettingsType> {
	defaultValue?: SettingsType;
	route: string;
}

export interface FabricItems<ItemType> {
	defaultValue?: ItemType[];
	route: string;
}

export interface Fabric<SettingsType, ItemType> {
	settings: FabricSettings<SettingsType>;
	items: FabricItems<ItemType>;
	fabricName: string;
}
