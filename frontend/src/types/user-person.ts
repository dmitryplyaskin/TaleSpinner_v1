export interface UserPerson {
	id: string;
	name: string;
	prefix?: string;
	imagePath?: string;
	content:
		| {
				type: 'default';
				value: string;
		  }
		| {
				type: 'extended';
				value: {
					id: string;
					tagName?: string;
					name?: string;
					value: string;
					isEnabled: boolean;
				};
		  };
}

export interface UserPersonSettings {
	selectedUserPersonId: string | null;
	isUserPersonEnabled: boolean;
}
