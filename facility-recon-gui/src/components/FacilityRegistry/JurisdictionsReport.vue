<template>
  <v-container fluid>
    <v-dialog
      persistent
      v-model="editDialog"
      transition="scale-transition"
      max-width="800px"
    >
      <v-toolbar
        color="primary"
        dark
      >
        <v-toolbar-title>
          Editing {{name}}
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <v-icon
          @click="editDialog = false"
          style="cursor: pointer"
        >close</v-icon>
      </v-toolbar>
      <v-card>
        <v-card-text>
          <v-layout
            column
            wrap
          >
            <v-flex xs1>
              <v-text-field
                required
                @blur="$v.name.$touch()"
                @change="$v.name.$touch()"
                :error-messages="nameErrors"
                v-model="name"
                box
                color="deep-purple"
                label="Name*"
              />
            </v-flex>
            <v-flex>
              <v-text-field
                required
                @blur="$v.code.$touch()"
                @change="$v.code.$touch()"
                :error-messages="codeErrors"
                v-model="code"
                box
                color="deep-purple"
                label="Code*"
              />
            </v-flex>
            <v-flex color="white">
              Current Parent: <b>{{parentPath}}</b><br>
              New Parent: <b>{{jurisdictionParent.text}}</b><br><br>
              Choose Different Parent
              <liquor-tree
                @node:selected="selectedEditJurisdiction"
                v-if="jurisdictionHierarchy.length > 0"
                :data="jurisdictionHierarchy"
                :options="treeOpts"
                :filter="searchJurisdiction"
                ref="jurisdictionHierarchy"
              >
                <div
                  slot-scope="{ node }"
                  class="node-container"
                >
                  <div class="node-text">{{ node.text }}</div>
                </div>
              </liquor-tree>
            </v-flex>
          </v-layout>
        </v-card-text>
        <v-card-actions>
          <v-layout column>
            <v-flex>
              <v-toolbar>
                <v-layout
                  row
                  wrap
                >
                  <v-flex
                    xs6
                    text-sm-left
                  >
                    <v-btn
                      color="error"
                      @click.native="editDialog = false"
                    >
                      <v-icon left>cancel</v-icon> Cancel
                    </v-btn>
                  </v-flex>
                  <v-flex
                    xs6
                    text-sm-right
                  >
                    <v-btn
                      color="primary"
                      :disabled="$v.$invalid"
                      dark
                      @click="saveEdit()"
                    >
                      <v-icon left>save</v-icon>
                      <template>
                        Save
                      </template>
                    </v-btn>
                  </v-flex>
                </v-layout>
              </v-toolbar>
            </v-flex>
          </v-layout>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-card>
      <v-card-title class="indigo white--text headline">
        <template v-if="requestCategory === 'updateRequest'">
          Choose Facility To Request Change Of Information
        </template>
        <template v-else>
          Administrative Areas List
        </template>
      </v-card-title>

      <v-layout justify-space-between>
        <v-scroll-y-transition>
          <v-flex xs2>
            <template v-if="loadingTree">
              <v-progress-linear :indeterminate="true"></v-progress-linear>
            </template>
            <liquor-tree
              @node:selected="selectedJurisdiction"
              v-if="jurisdictionHierarchy.length > 0"
              :data="jurisdictionHierarchy"
              :options="treeOpts"
              ref="jurisdictionHierarchy"
            />
          </v-flex>
        </v-scroll-y-transition>

        <v-divider vertical></v-divider>

        <v-flex
          d-flex
          text-center
        >
          <v-scroll-y-transition mode="out-in">
            <v-card
              v-if='activeJurisdiction.id'
              flat
            >
              <v-card-title primary-title>
                <v-layout
                  row
                  wrap
                >
                  <v-flex>
                    <b>
                      <center>Administrative Areas Under {{activeJurisdiction.text}}</center>
                    </b>
                  </v-flex>
                  <v-spacer></v-spacer>
                  <v-flex>
                    <v-text-field
                      v-model="searchJurisdictions"
                      append-icon="search"
                      label="Search Facility"
                      single-line
                      hide-details
                    ></v-text-field>
                  </v-flex>
                </v-layout>
              </v-card-title>
              <v-card-text>
                <v-data-table
                  :loading="loadingJurisdictions"
                  :headers="jurisdictionsHeaders"
                  :items="jurisdictions"
                  :search="searchJurisdictions"
                  class="elevation-1"
                >
                  <template
                    slot="items"
                    slot-scope="props"
                  >
                    <td>
                      <v-tooltip top>
                        <v-btn
                          v-if="canEditJurisdiction(props.item)"
                          icon
                          color="primary"
                          slot="activator"
                          @click="edit(props.item)"
                        >
                          <v-icon>edit</v-icon>
                        </v-btn>
                        <span>Edit</span>
                      </v-tooltip>
                    </td>
                    <td>{{props.item.name}}</td>
                    <td>{{props.item.code}}</td>
                    <td>{{props.item.parent}}</td>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
            <template v-else-if="!loadingJurisdictions">
              <b>Select a jurisdiction on the left to display its children</b>
            </template>
          </v-scroll-y-transition>
        </v-flex>
      </v-layout>
    </v-card>
  </v-container>
</template>
<script>
import axios from 'axios'
import LiquorTree from 'liquor-tree'
import { required } from 'vuelidate/lib/validators'
import { generalMixin } from '../../mixins/generalMixin'
import {
  tasksVerification
} from '@/modules/tasksVerification'
const backendServer = process.env.BACKEND_SERVER
export default {
  mixins: [generalMixin],
  validations: {
    name: { required },
    code: {
      required,
      isValidCode: function isValidCode (value, vm) {
        if (!value) {
          return false
        }
        let codeLength = value.split('.').length
        if (!value.split('.')[codeLength - 1]) {
          return false
        }
        if (vm.jurisdictionParent.data && parseInt(vm.jurisdictionParent.data.level) + 2 !== codeLength) {
          return false
        } else if (vm.jurisdictionParent.code) {
          let parCodeLength = vm.jurisdictionParent.code.split('.').length
          if (parCodeLength + 1 !== codeLength) {
            return false
          }
        }
        return true
      }
    }
  },
  props: ['action', 'requestType', 'requestCategory'],
  data () {
    return {
      jurisdictionId: '',
      editDialog: false,
      loadingTree: false,
      loadingJurisdictions: false,
      jurisdictionsHeaders: [
        { sortable: false },
        { text: 'Name', value: 'name' },
        { text: 'Code', value: 'code' },
        { text: 'Parent', value: 'parent' }
      ],
      searchJurisdiction: '',
      searchJurisdictions: '',
      activeJurisdiction: {},
      jurisdictionHierarchy: [],
      treeOpts: {
        fetchData (node) {
          return axios.get(backendServer + '/FR/getTree', {
            params: {
              includeBuilding: false,
              sourceLimitOrgId: node.id,
              recursive: false
            }
          }).then((hierarchy) => {
            return hierarchy.data
          })
        }
      },
      jurisdictions: [],
      name: '',
      code: '',
      parentPath: '',
      jurisdictionParent: {},
      confirm: false,
      confirmTitle: '',
      tasksVerification: tasksVerification
    }
  },
  methods: {
    canEditJurisdiction (item) {
      if (item.requestStatus === 'Approved' && this.requestCategory === 'requestsList') {
        return false
      }
      if (this.tasksVerification.canEdit('FacilitiesReport') || this.tasksVerification.canAdd('RequestUpdateBuildingDetails')) {
        return true
      }
      return false
    },
    getJurisdictions () {
      this.facilities = []
      this.jurisdictions = []
      this.loadingJurisdictions = true
      axios.get(backendServer + '/FR/getJurisdictions', {
        params: {
          jurisdiction: this.activeJurisdiction.id,
          action: this.action,
          requestType: this.requestType,
          requestCategory: this.requestCategory
        }
      }).then((response) => {
        this.loadingJurisdictions = false
        this.jurisdictions = response.data
      }).catch((err) => {
        this.loadingJurisdictions = false
        console.log(err)
      })
    },
    selectedJurisdiction (node) {
      this.activeJurisdiction = node
      this.getJurisdictions()
    },
    selectedEditJurisdiction (node) {
      this.jurisdictionParent = node
    },
    edit (item) {
      this.jurisdictionId = item.id
      this.jurisdictionParent.id = item.immediateParent.id
      this.jurisdictionParent.text = item.immediateParent.name
      this.jurisdictionParent.code = item.immediateParent.code
      this.parentPath = item.parent
      this.name = item.name
      this.code = item.code
      this.editDialog = true
    },
    saveEdit () {
      let formData = new FormData()
      formData.append('id', this.jurisdictionId)
      formData.append('name', this.name)
      formData.append('code', this.code)
      formData.append('parent', this.jurisdictionParent.id)
      formData.append('username', this.$store.state.auth.username)
      this.$store.state.progressTitle = 'Saving Changes'
      this.editDialog = false
      this.$store.state.dynamicProgress = true
      axios.post(backendServer + '/FR/updateJurisdiction', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then((response) => {
        this.$store.state.dynamicProgress = false
        this.$store.state.errorColor = 'primary'
        this.$store.state.errorTitle = 'Changes Saved'
        this.$store.state.errorDescription = 'Changes saved successfully'
        this.$store.state.dialogError = true
        this.getJurisdictions()
      }).catch((err) => {
        this.$store.state.dynamicProgress = false
        this.$store.state.errorTitle = 'Failed To Save Changes'
        this.$store.state.errorDescription = 'Failed To Save Changes'
        this.$store.state.errorColor = 'error'
        this.$store.state.dialogError = true
        console.log(err)
      })
    }
  },
  created () {
    this.loadingTree = true
    this.getTree(false, false, (err, tree) => {
      if (!err) {
        this.loadingTree = false
        this.jurisdictionHierarchy = tree
      } else {
        this.loadingTree = false
      }
    })
    if (this.action === 'request' && this.requestCategory === 'requestsList') {
      this.jurisdictionsHeaders.push({ text: 'Request Status', value: 'requestStatus' })
    }
  },
  computed: {
    nameErrors () {
      const errors = []
      if (!this.$v.name.$dirty) return errors
      !this.$v.name.required && errors.push('Name is required')
      return errors
    },
    codeErrors () {
      const errors = []
      if (!this.$v.code.$dirty) return errors
      !this.$v.code.required && errors.push('Code is required')
      !this.$v.code.isValidCode && errors.push('Invalid code')
      return errors
    }
  },
  components: {
    'liquor-tree': LiquorTree
  }
}
</script>