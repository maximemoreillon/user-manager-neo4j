const user_editable_fields = [
  'avatar_src',
  'last_name',
  'display_name',
  'first_name',
  'website',
]

const admin_editable_fields = [
  ...user_editable_fields,
  'isAdmin',
  'locked',
  'activated',
]

exports.user_editable_fields = user_editable_fields
exports.admin_editable_fields = admin_editable_fields
