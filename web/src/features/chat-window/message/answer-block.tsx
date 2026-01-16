export const AnswerBlock = () => {
	return (
		<Box>
			<ActionBar
				data={data}
				messageId={messageId}
				swipeId={swipeId}
				isEditing={isEditing}
				setIsEditing={setIsEditing}
			/>
		</Box>
	);
};
