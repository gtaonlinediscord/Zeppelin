import { logsEvent } from "../types";
import { stripObjectToScalars, findRelevantAuditLogEntry, UnknownUser } from "src/utils";
import { Constants as ErisConstants } from "eris";
import { LogType } from "src/data/LogType";
import isEqual from "lodash.isequal";
import diff from "lodash.difference";

export const LogsGuildMemberUpdateEvt = logsEvent({
  event: "guildMemberUpdate",

  async listener(meta) {
    const pluginData = meta.pluginData;
    const oldMember = meta.args.oldMember;
    const member = meta.args.member;

    if (!oldMember) return;

    const logMember = stripObjectToScalars(member, ["user", "roles"]);

    if (member.nick !== oldMember.nick) {
      pluginData.state.guildLogs.log(LogType.MEMBER_NICK_CHANGE, {
        member: logMember,
        oldNick: oldMember.nick != null ? oldMember.nick : "<none>",
        newNick: member.nick != null ? member.nick : "<none>",
      });
    }

    if (!isEqual(oldMember.roles, member.roles)) {
      const addedRoles = diff(member.roles, oldMember.roles);
      const removedRoles = diff(oldMember.roles, member.roles);
      let skip = false;

      if (
        addedRoles.length &&
        removedRoles.length &&
        pluginData.state.guildLogs.isLogIgnored(LogType.MEMBER_ROLE_CHANGES, member.id)
      ) {
        skip = true;
      } else if (addedRoles.length && pluginData.state.guildLogs.isLogIgnored(LogType.MEMBER_ROLE_ADD, member.id)) {
        skip = true;
      } else if (
        removedRoles.length &&
        pluginData.state.guildLogs.isLogIgnored(LogType.MEMBER_ROLE_REMOVE, member.id)
      ) {
        skip = true;
      }

      if (!skip) {
        const relevantAuditLogEntry = await findRelevantAuditLogEntry(
          pluginData.guild,
          ErisConstants.AuditLogActions.MEMBER_ROLE_UPDATE,
          member.id,
        );
        const mod = relevantAuditLogEntry ? relevantAuditLogEntry.user : new UnknownUser();

        if (addedRoles.length && removedRoles.length) {
          // Roles added *and* removed
          pluginData.state.guildLogs.log(
            LogType.MEMBER_ROLE_CHANGES,
            {
              member: logMember,
              addedRoles: addedRoles
                .map(roleId => pluginData.guild.roles.get(roleId) || { id: roleId, name: `Unknown (${roleId})` })
                .map(r => r.name)
                .join(", "),
              removedRoles: removedRoles
                .map(roleId => pluginData.guild.roles.get(roleId) || { id: roleId, name: `Unknown (${roleId})` })
                .map(r => r.name)
                .join(", "),
              mod: stripObjectToScalars(mod),
            },
            member.id,
          );
        } else if (addedRoles.length) {
          // Roles added
          pluginData.state.guildLogs.log(
            LogType.MEMBER_ROLE_ADD,
            {
              member: logMember,
              roles: addedRoles
                .map(roleId => pluginData.guild.roles.get(roleId) || { id: roleId, name: `Unknown (${roleId})` })
                .map(r => r.name)
                .join(", "),
              mod: stripObjectToScalars(mod),
            },
            member.id,
          );
        } else if (removedRoles.length && !addedRoles.length) {
          // Roles removed
          pluginData.state.guildLogs.log(
            LogType.MEMBER_ROLE_REMOVE,
            {
              member: logMember,
              roles: removedRoles
                .map(roleId => pluginData.guild.roles.get(roleId) || { id: roleId, name: `Unknown (${roleId})` })
                .map(r => r.name)
                .join(", "),
              mod: stripObjectToScalars(mod),
            },
            member.id,
          );
        }
      }
    }
  },
});

export const LogsUserUpdateEvt = logsEvent({
  event: "userUpdate",
  allowSelf: true,

  async listener(meta) {
    const pluginData = meta.pluginData;
    const oldUser = meta.args.oldUser;
    const user = meta.args.user;

    if (!oldUser) return;

    if (!pluginData.guild.members.has(user.id)) return;

    if (user.username !== oldUser.username || user.discriminator !== oldUser.discriminator) {
      pluginData.state.guildLogs.log(LogType.MEMBER_USERNAME_CHANGE, {
        user: stripObjectToScalars(user),
        oldName: `${oldUser.username}#${oldUser.discriminator}`,
        newName: `${user.username}#${user.discriminator}`,
      });
    }
  },
});