<template>
  <v-container fluid>
    <v-dialog
      v-model="confirm"
      width="630px"
    >
      <v-toolbar
        color="error"
        dark
      >
        <v-toolbar-title>
          Confirmation
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          icon
          dark
          @click.native="confirm = false"
        >
          <v-icon>close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card>
        <v-card-text>
          {{confirmTitle}}
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="error"
            @click.native="confirm = false"
          >Cancel</v-btn>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            @click="changeRequestStatus"
          >Proceed</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
                label="Name"
              />
            </v-flex>
            <v-flex>
              <v-select
                clearable
                :items="status"
                v-model="facilityStatus"
                label="Status"
              ></v-select>
            </v-flex>
            <v-flex color="white">
              Selected Parent: <b>{{facilityParent.text}}</b><br><br>
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
                      Save
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
        List of District Vaccine Stores
      </v-card-title>

      <v-layout justify-space-between>
        <v-scroll-y-transition>
          <v-flex xs2>
            <v-text-field
              v-model="searchJurisdiction"
              append-icon="search"
              label="Search Jurisdiction"
              single-line
              hide-details
            ></v-text-field>
            <template v-if="loadingTree">
              <v-progress-linear :indeterminate="true"></v-progress-linear>
            </template>
            <liquor-tree
              @node:selected="selectedJurisdiction"
              v-if="jurisdictionHierarchy.length > 0"
              :data="jurisdictionHierarchy"
              :options="treeOpts"
              :filter="searchJurisdiction"
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
                      <center>DVS Under {{activeJurisdiction.text}}</center>
                    </b>
                  </v-flex>
                  <v-spacer></v-spacer>
                  <v-flex>
                    <v-text-field
                      v-model="searchBuildings"
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
                  :loading="loadingBuildings"
                  :headers="buildingsHeaders"
                  :items="buildings"
                  :search="searchBuildings"
                  class="elevation-1"
                >
                  <template
                    slot="items"
                    slot-scope="props"
                  >
                    <td>
                      <v-tooltip top>
                        <v-btn
                          v-if="canEditBuilding(props.item)"
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
                    <td>{{props.item.parent.name}}</td>
                    <td>{{props.item.status.text}}</td>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
            <template v-else-if="!loadingBuildings">
              <b>Select a jurisdiction on the left to display its facilities</b>
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
    name: { required }
  },
  props: ['action', 'requestType', 'requestCategory'],
  data () {
    return {
      facilityId: '',
      editDialog: false,
      loadingTree: false,
      loadingBuildings: false,
      buildingsHeaders: [
        { sortable: false },
        { text: 'Name', value: 'name' },
        { text: 'Parent', value: 'parent' },
        { text: 'Status', value: 'status' }
      ],
      searchJurisdiction: '',
      searchBuildings: '',
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
      buildings: [],
      name: '',
      code: '',
      description: '',
      status: [{
        text: 'Functional',
        value: 'active'
      }, {
        text: 'Not Functional',
        value: 'inactive'
      }, {
        text: 'Suspended',
        value: 'suspended'
      }],
      facilityStatus: '',
      facilityParent: {},
      requestStatus: '',
      confirm: false,
      confirmTitle: '',
      tasksVerification: tasksVerification
    }
  },
  methods: {
    changeRequestStatus (item, status, isConfirm) {
      if (isConfirm) {
        this.requestStatus = status
        let statusDisplay
        if (status === 'approved') {
          statusDisplay = 'approved'
        } else if (status === 'rejected') {
          statusDisplay = 'rejected'
        }
        this.confirm = true
        this.confirmTitle = 'Are you sure that you want to mark facility ' + item.name + ' as ' + statusDisplay
        this.facilityId = item.id
      } else {
        this.$store.state.progressTitle = 'Saving new status'
        this.confirm = false
        this.$store.state.dynamicProgress = true
        let formData = new FormData()
        formData.append('id', this.facilityId)
        formData.append('status', this.requestStatus)
        formData.append('requestType', this.requestType)
        axios.post(backendServer + '/FR/changeBuildingRequestStatus', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }).then(() => {
          this.$store.state.dynamicProgress = false
          this.$store.state.errorTitle = 'Info'
          this.$store.state.errorDescription = 'Request status changed successfully'
          this.$store.state.dialogError = true
          this.getBuildings()
        }).catch((err) => {
          this.$store.state.errorTitle = 'Error'
          this.$store.state.errorDescription = 'This request was not successfully processed'
          this.$store.state.dialogError = true
          console.log(err)
        })
      }
    },
    canChangeRequestStatus (item, actionName) {
      if (this.action !== 'request' || (this.action === 'request' && this.requestCategory !== 'requestsList')) {
        return false
      }
      if (actionName === 'approve') {
        if (item.requestStatus === 'Approved') {
          return false
        }
      } else if (actionName === 'reject') {
        if (item.requestStatus === 'Approved' || item.requestStatus === 'Rejected') {
          return false
        }
      }
      if ((this.requestType === 'update' && this.tasksVerification.canApprove('FacilitiesUpdateRequestsReport')) ||
        (this.requestType === 'add' && this.tasksVerification.canApprove('NewFacilitiesRequestsReport')) ||
        (this.requestType === 'update' && this.tasksVerification.canReject('FacilitiesUpdateRequestsReport')) ||
        (this.requestType === 'add' && this.tasksVerification.canReject('NewFacilitiesRequestsReport'))) {
        return true
      } else {
        return false
      }
    },
    canEditBuilding (item) {
      if (item.requestStatus === 'Approved' && this.requestCategory === 'requestsList') {
        return false
      }
      if (this.tasksVerification.canEdit('FacilitiesReport') || this.tasksVerification.canAdd('RequestUpdateBuildingDetails')) {
        return true
      }
      return false
    },
    getBuildings () {
      this.facilities = []
      this.buildings = []
      this.loadingBuildings = true
      axios.get(backendServer + '/FR/getBuildings', {
        params: {
          jurisdiction: this.activeJurisdiction.id,
          action: this.action,
          requestType: this.requestType,
          requestCategory: this.requestCategory,
          onlyDVS: true
        }
      }).then((response) => {
        this.loadingBuildings = false
        this.buildings = response.data
      }).catch((err) => {
        this.loadingBuildings = false
        console.log(err)
      })
    },
    selectedJurisdiction (node) {
      this.activeJurisdiction = node
      this.getBuildings()
    },
    selectedEditJurisdiction (node) {
      this.facilityParent = node
    },
    edit (item) {
      this.facilityId = item.id
      this.facilityStatus = item.status.code
      this.facilityParent.id = item.parent.id
      this.facilityParent.text = item.parent.name
      this.name = item.name
      this.editDialog = true
    },
    saveEdit () {
      let formData = new FormData()
      formData.append('id', this.facilityId)
      formData.append('name', this.name)
      formData.append('action', this.action)
      formData.append('requestType', this.requestType)
      formData.append('username', this.$store.state.auth.username)
      if (this.facilityStatus) {
        formData.append('status', this.facilityStatus)
      }
      formData.append('parent', this.facilityParent.id)
      this.$store.state.progressTitle = 'Saving Changes'
      this.editDialog = false
      this.$store.state.dynamicProgress = true
      axios.post(backendServer + '/FR/addBuilding', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then((response) => {
        this.$store.state.dynamicProgress = false
        this.$store.state.errorTitle = 'Changes Saved'
        this.$store.state.errorDescription = 'Changes saved successfully'
        this.$store.state.dialogError = true
        this.getBuildings()
      }).catch((err) => {
        this.$store.state.errorTitle = 'Failed To Save Changes'
        this.$store.state.errorDescription = 'Failed To Save Changes'
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
      this.buildingsHeaders.push({ text: 'Request Status', value: 'requestStatus' })
    }
  },
  computed: {
    nameErrors () {
      const errors = []
      if (!this.$v.name.$dirty) return errors
      !this.$v.name.required && errors.push('Name is required')
      return errors
    }
  },
  components: {
    'liquor-tree': LiquorTree
  }
}
</script>